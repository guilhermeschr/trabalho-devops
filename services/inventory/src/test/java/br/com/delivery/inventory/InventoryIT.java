package br.com.delivery.inventory;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import br.com.delivery.inventory.application.ports.*;
import br.com.delivery.inventory.domain.*;
import br.com.delivery.inventory.infrastructure.messaging.OutboxPublisherWorker;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@Testcontainers
@SpringBootTest(
    properties = {
      "SWAGGER_ENABLED=true",
      "NODE_ENV=development",
      "inventory.jwt-secret=test-jwt-secret",
      "inventory.internal-token=test-internal",
      "inventory.rabbitmq.url=amqp://guest:guest@localhost:5672",
      "spring.rabbitmq.listener.simple.auto-startup=false"
    })
@AutoConfigureMockMvc
class InventoryIT {
  @Container
  static PostgreSQLContainer<?> write =
      new PostgreSQLContainer<>("postgres:16-alpine").withInitScript("legacy-write.sql");

  @Container
  static PostgreSQLContainer<?> read =
      new PostgreSQLContainer<>("postgres:16-alpine").withInitScript("legacy-read.sql");

  @DynamicPropertySource
  static void databases(DynamicPropertyRegistry props) {
    props.add("inventory.write.url", write::getJdbcUrl);
    props.add("inventory.write.username", write::getUsername);
    props.add("inventory.write.password", write::getPassword);
    props.add("inventory.read.url", read::getJdbcUrl);
    props.add("inventory.read.username", read::getUsername);
    props.add("inventory.read.password", read::getPassword);
  }

  @MockitoBean OutboxPublisherWorker worker;
  @Autowired StockWriteRepository writes;
  @Autowired StockReadRepository reads;
  @Autowired OutboxRepository outbox;

  @Autowired
  @Qualifier("writeJdbc")
  JdbcTemplate writeJdbc;

  @Autowired
  @Qualifier("readJdbc")
  JdbcTemplate readJdbc;

  @Autowired MockMvc http;

  String jwt() {
    return "Bearer "
        + JWT.create()
            .withSubject("user")
            .withExpiresAt(Instant.now().plusSeconds(120))
            .sign(Algorithm.HMAC256("test-jwt-secret"));
  }

  @Test
  void adoptsLegacyTablesWithoutDataLoss() {
    UUID id = UUID.fromString("4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20");
    UUID order = UUID.fromString("d3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc");
    assertEquals(18, reads.findById(id).orElseThrow().availableQuantity());
    assertEquals(18, writes.debit(order, id, 2).remainingQuantity());
    assertEquals(
        18,
        writeJdbc.queryForObject(
            "SELECT available_quantity FROM stock WHERE product_id=?", Integer.class, id));
    assertEquals(
        1,
        writeJdbc.queryForObject(
            "SELECT count(*) FROM stock_movements WHERE order_id=?", Integer.class, order));
  }

  @Test
  void concurrencyIdempotencyAndNoOverselling() throws Exception {
    UUID id = UUID.randomUUID(), order = UUID.randomUUID();
    assertEquals(20, writes.add(id, 20).availableQuantity());
    try (var pool = Executors.newFixedThreadPool(10)) {
      var retries = new ArrayList<Callable<DebitResult>>();
      for (int i = 0; i < 10; i++) retries.add(() -> writes.debit(order, id, 2));
      for (var result : pool.invokeAll(retries)) assertEquals(18, result.get().remainingQuantity());
      var attempts = new ArrayList<Callable<Boolean>>();
      for (int i = 0; i < 10; i++)
        attempts.add(
            () -> {
              try {
                writes.debit(UUID.randomUUID(), id, 3);
                return true;
              } catch (StockException e) {
                assertEquals("INSUFFICIENT_STOCK", e.code());
                return false;
              }
            });
      int successful = 0;
      for (var result : pool.invokeAll(attempts)) if (result.get()) successful++;
      assertEquals(6, successful);
    }
    assertEquals(
        0,
        writeJdbc.queryForObject(
            "SELECT available_quantity FROM stock WHERE product_id=?", Integer.class, id));
    assertEquals(
        8,
        writeJdbc.queryForObject(
            "SELECT count(*) FROM stock_movements WHERE product_id=?", Integer.class, id));
    assertEquals(
        8,
        writeJdbc.queryForObject(
            "SELECT count(*) FROM outbox_events WHERE aggregate_id=?", Integer.class, id));
    assertThrows(StockException.class, () -> writes.debit(order, id, 1));
  }

  @Test
  void addsToExistingAndRejectsOverflowAndMissingStock() {
    UUID id = UUID.randomUUID();
    writes.add(id, 20);
    assertEquals(25, writes.add(id, 5).availableQuantity());
    assertThrows(StockException.class, () -> writes.add(id, Integer.MAX_VALUE));
    assertThrows(StockException.class, () -> writes.debit(UUID.randomUUID(), UUID.randomUUID(), 1));
  }

  @Test
  void rollsBackStockAndMovementWhenOutboxFails() {
    UUID id = UUID.randomUUID();
    writes.add(id, 20);
    writeJdbc.execute(
        "ALTER TABLE outbox_events ADD CONSTRAINT test_reject_outbox CHECK (aggregate_id <> '"
            + id
            + "'::uuid) NOT VALID");
    try {
      assertThrows(RuntimeException.class, () -> writes.debit(UUID.randomUUID(), id, 2));
    } finally {
      writeJdbc.execute("ALTER TABLE outbox_events DROP CONSTRAINT test_reject_outbox");
    }
    assertEquals(
        20,
        writeJdbc.queryForObject(
            "SELECT available_quantity FROM stock WHERE product_id=?", Integer.class, id));
    assertEquals(
        1,
        writeJdbc.queryForObject(
            "SELECT count(*) FROM stock_movements WHERE product_id=?", Integer.class, id));
  }

  @Test
  void projectionIsAtomicIdempotentAndVersioned() {
    UUID id = UUID.randomUUID();
    assertTrue(reads.findById(id).isEmpty());
    var newer =
        new StockEvent(
            UUID.randomUUID(),
            "inventory.stock_debited",
            id,
            Instant.now(),
            2,
            new Stock(id, 18, Instant.now()));
    reads.project(newer);
    reads.project(newer);
    reads.project(
        new StockEvent(
            UUID.randomUUID(),
            "inventory.stock_added",
            id,
            Instant.now(),
            1,
            new Stock(id, 20, Instant.now())));
    assertEquals(18, reads.findById(id).orElseThrow().availableQuantity());
    assertEquals(
        1,
        readJdbc.queryForObject(
            "SELECT count(*) FROM processed_events WHERE event_id=?",
            Integer.class,
            newer.eventId()));
    var rejected =
        new StockEvent(
            UUID.randomUUID(),
            "inventory.stock_added",
            id,
            Instant.now(),
            3,
            new Stock(id, 21, Instant.now()));
    readJdbc.execute(
        "ALTER TABLE stock_projection ADD CONSTRAINT test_reject_projection CHECK (product_id <> '"
            + id
            + "'::uuid) NOT VALID");
    try {
      assertThrows(RuntimeException.class, () -> reads.project(rejected));
    } finally {
      readJdbc.execute("ALTER TABLE stock_projection DROP CONSTRAINT test_reject_projection");
    }
    assertEquals(
        0,
        readJdbc.queryForObject(
            "SELECT count(*) FROM processed_events WHERE event_id=?",
            Integer.class,
            rejected.eventId()));
  }

  @Test
  void outboxKeepsCompatiblePayloadAndTracksAttempts() {
    UUID id = UUID.randomUUID();
    writes.add(id, 7);
    var event =
        outbox.findPending(1000).stream()
            .filter(e -> id.equals(e.aggregateId()))
            .findFirst()
            .orElseThrow();
    assertEquals(7, event.payload().availableQuantity());
    outbox.markFailed(event.eventId(), "x".repeat(1100));
    assertEquals(
        1000,
        writeJdbc.queryForObject(
            "SELECT length(last_error) FROM outbox_events WHERE event_id=?",
            Integer.class,
            event.eventId()));
    assertEquals(
        1,
        writeJdbc.queryForObject(
            "SELECT attempts FROM outbox_events WHERE event_id=?", Integer.class, event.eventId()));
    outbox.markPublished(event.eventId());
    assertTrue(
        outbox.findPending(1000).stream().noneMatch(e -> event.eventId().equals(e.eventId())));
  }

  @Test
  void httpContractValidationAndSecurity() throws Exception {
    UUID id = UUID.randomUUID();
    String body = "{\"productId\":\"" + id + "\",\"quantity\":20}";
    http.perform(post("/api/v1/inventory").contentType("application/json").content(body))
        .andExpect(status().isUnauthorized());
    http.perform(
            post("/api/v1/inventory")
                .header("Authorization", jwt())
                .contentType("application/json")
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.availableQuantity").value(20));
    http.perform(get("/api/v1/inventory/" + id).header("Authorization", jwt()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("STOCK_NOT_FOUND"));
    for (String quantity : List.of("0", "-1", "1.5", "\"2\"", "2147483648", "null"))
      http.perform(
              post("/api/v1/inventory")
                  .header("Authorization", jwt())
                  .contentType("application/json")
                  .content("{\"productId\":\"" + id + "\",\"quantity\":" + quantity + "}"))
          .andExpect(status().isBadRequest());
    http.perform(
            post("/api/v1/inventory")
                .header("Authorization", jwt())
                .contentType("application/json")
                .content(body.replace("20}", "20,\"extra\":true}")))
        .andExpect(status().isBadRequest());
    http.perform(get("/api/v1/inventory/invalid").header("Authorization", jwt()))
        .andExpect(status().isBadRequest());
    http.perform(post("/internal/v1/inventory/debit").contentType("application/json").content("{}"))
        .andExpect(status().isForbidden());
    http.perform(
            post("/internal/v1/inventory/debit")
                .header("X-Internal-Token", "test-internal")
                .contentType("application/json")
                .content("{}"))
        .andExpect(status().isBadRequest());
    String debit = body.replace("20}", "2,\"orderId\":\"" + UUID.randomUUID() + "\"}");
    http.perform(
            post("/internal/v1/inventory/debit")
                .header("X-Internal-Token", "test-internal")
                .contentType("application/json")
                .content(debit))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.remainingQuantity").value(18));
    http.perform(
            post("/internal/v1/inventory/debit")
                .header("X-Internal-Token", "test-internal")
                .header("X-Request-Id", "trace-test")
                .contentType("application/json")
                .content(debit.replace("\"quantity\":2", "\"quantity\":200")))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.traceId").value("trace-test"));
    http.perform(get("/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.service").value("inventory-service"));
  }

  @Test
  void rejectsNonCanonicalUuidFormats() throws Exception {
    for (String invalid : List.of("1-1-1-1-1", "AAAAAAAAAAAAAAAAAAAAAA==")) {
      http.perform(get("/api/v1/inventory/" + invalid).header("Authorization", jwt()))
          .andExpect(status().isBadRequest());
      http.perform(
              post("/api/v1/inventory")
                  .header("Authorization", jwt())
                  .contentType("application/json")
                  .content("{\"productId\":\"" + invalid + "\",\"quantity\":2}"))
          .andExpect(status().isBadRequest());
    }
  }

  @Test
  void swaggerDocumentsAllRoutesAndUi() throws Exception {
    http.perform(get("/docs-json"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paths['/api/v1/inventory'].post.responses['200']").exists())
        .andExpect(
            jsonPath("$.paths['/internal/v1/inventory/debit'].post.responses['403']").exists())
        .andExpect(jsonPath("$.components.securitySchemes.jwt").exists())
        .andExpect(jsonPath("$.components.schemas.StockResponseDto").exists());
    http.perform(get("/docs")).andExpect(status().isOk());
    http.perform(get("/docs/"))
        .andExpect(status().isOk())
        .andExpect(content().string(org.hamcrest.Matchers.containsString("../swagger-ui/")));
    http.perform(get("/swagger-ui/swagger-ui-bundle.js")).andExpect(status().isOk());
  }
}
