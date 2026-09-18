package br.com.delivery.inventory.infrastructure.persistence;

import br.com.delivery.inventory.application.ports.StockWriteRepository;
import br.com.delivery.inventory.domain.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class StockWriteJdbcRepository implements StockWriteRepository {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;

  public StockWriteJdbcRepository(@Qualifier("writeJdbc") JdbcTemplate jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  private record Row(Stock stock, int version) {}

  private Row row(ResultSet rs, int number) throws SQLException {
    return new Row(
        new Stock(
            rs.getObject("product_id", UUID.class),
            rs.getInt("available_quantity"),
            rs.getTimestamp("updated_at").toInstant()),
        rs.getInt("version"));
  }

  private void lock(String key) {
    jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", rs -> {}, key);
  }

  @Override
  @Transactional("writeTransactionManager")
  public Stock add(UUID productId, int quantity) {
    lock("stock:" + productId);
    var current =
        jdbc.query("SELECT * FROM stock WHERE product_id=? FOR UPDATE", this::row, productId);
    int balance =
        StockRules.add(
            current.isEmpty() ? 0 : current.getFirst().stock().availableQuantity(), quantity);
    Row updated =
        jdbc.queryForObject(
            "INSERT INTO stock(product_id,available_quantity,version,updated_at)"
                + " VALUES(?,?,1,clock_timestamp()) ON CONFLICT(product_id) DO UPDATE SET"
                + " available_quantity=EXCLUDED.available_quantity,version=stock.version+1,updated_at=clock_timestamp()"
                + " RETURNING *",
            this::row,
            productId,
            balance);
    record(updated, quantity, "add", null);
    return updated.stock();
  }

  @Override
  @Transactional("writeTransactionManager")
  public DebitResult debit(UUID orderId, UUID productId, int quantity) {
    lock("order:" + orderId);
    var previous =
        jdbc.query(
            "SELECT * FROM stock_movements WHERE order_id=?",
            (rs, n) ->
                new DebitResult(
                    orderId,
                    rs.getObject("product_id", UUID.class),
                    rs.getInt("quantity"),
                    rs.getInt("remaining_quantity")),
            orderId);
    if (!previous.isEmpty()) return StockRules.replay(previous.getFirst(), productId, quantity);
    lock("stock:" + productId);
    var current =
        jdbc.query("SELECT * FROM stock WHERE product_id=? FOR UPDATE", this::row, productId);
    int balance =
        StockRules.debit(
            current.isEmpty() ? 0 : current.getFirst().stock().availableQuantity(), quantity);
    Row updated =
        jdbc.queryForObject(
            "UPDATE stock SET available_quantity=?,version=version+1,updated_at=clock_timestamp()"
                + " WHERE product_id=? RETURNING *",
            this::row,
            balance,
            productId);
    record(updated, quantity, "debit", orderId);
    return new DebitResult(orderId, productId, quantity, balance);
  }

  private void record(Row row, int quantity, String kind, UUID orderId) {
    var stock = row.stock();
    jdbc.update(
        "INSERT INTO"
            + " stock_movements(id,order_id,product_id,quantity,kind,remaining_quantity,created_at)"
            + " VALUES(?,?,?,?,?,?,?)",
        UUID.randomUUID(),
        orderId,
        stock.productId(),
        quantity,
        kind,
        stock.availableQuantity(),
        Timestamp.from(stock.updatedAt()));
    String payload;
    try {
      payload = json.writeValueAsString(stock);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Falha ao serializar estoque", e);
    }
    jdbc.update(
        "INSERT INTO outbox_events(event_id,event_type,aggregate_id,payload,occurred_at,version)"
            + " VALUES(?,?,?,?::jsonb,?,?)",
        UUID.randomUUID(),
        "add".equals(kind) ? "inventory.stock_added" : "inventory.stock_debited",
        stock.productId(),
        payload,
        Timestamp.from(stock.updatedAt()),
        row.version());
  }
}
