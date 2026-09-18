package br.com.delivery.inventory;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import br.com.delivery.inventory.application.ports.*;
import br.com.delivery.inventory.application.usecase.*;
import br.com.delivery.inventory.domain.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class StockRulesTest {
  @Test
  void additionAndDebit() {
    assertEquals(25, StockRules.add(20, 5));
    assertEquals(18, StockRules.debit(20, 2));
    assertEquals(0, StockRules.debit(2, 2));
  }

  @ParameterizedTest
  @ValueSource(ints = {0, -1, Integer.MIN_VALUE})
  void rejectsInvalidQuantity(int quantity) {
    assertEquals(
        400,
        assertThrows(StockException.class, () -> StockRules.validateQuantity(quantity)).status());
  }

  @Test
  void nullAndOverflow() {
    assertThrows(StockException.class, () -> StockRules.validateQuantity(null));
    assertEquals(
        "STOCK_LIMIT_EXCEEDED",
        assertThrows(StockException.class, () -> StockRules.add(Integer.MAX_VALUE, 1)).code());
    assertEquals(
        "INSUFFICIENT_STOCK",
        assertThrows(StockException.class, () -> StockRules.debit(1, 2)).code());
  }

  @Test
  void replay() {
    var result = new DebitResult(UUID.randomUUID(), UUID.randomUUID(), 2, 18);
    assertSame(result, StockRules.replay(result, result.productId(), 2));
    assertThrows(StockException.class, () -> StockRules.replay(result, UUID.randomUUID(), 2));
    assertThrows(StockException.class, () -> StockRules.replay(result, result.productId(), 3));
  }

  @Test
  void useCasesDelegateAndHandleMissingStock() {
    var write = mock(StockWriteRepository.class);
    var read = mock(StockReadRepository.class);
    UUID product = UUID.randomUUID(), order = UUID.randomUUID();
    var stock = new Stock(product, 20, Instant.now());
    var debit = new DebitResult(order, product, 2, 18);
    when(write.add(product, 20)).thenReturn(stock);
    when(write.debit(order, product, 2)).thenReturn(debit);
    when(read.findById(product)).thenReturn(Optional.of(stock), Optional.empty());
    assertEquals(stock, new AddStockUseCase(write).execute(product, 20));
    assertEquals(debit, new DebitStockUseCase(write).execute(order, product, 2));
    assertEquals(stock, new GetStockUseCase(read).execute(product));
    assertEquals(
        404,
        assertThrows(StockException.class, () -> new GetStockUseCase(read).execute(product))
            .status());
    assertThrows(StockException.class, () -> new AddStockUseCase(write).execute(product, 0));
    assertThrows(
        StockException.class, () -> new DebitStockUseCase(write).execute(order, product, 0));
    verify(write, times(1)).add(any(), anyInt());
  }

  @Test
  void validatesEventEnvelope() {
    UUID id = UUID.randomUUID();
    Stock payload = new Stock(id, 20, Instant.now());
    new StockEvent(UUID.randomUUID(), "inventory.stock_added", id, Instant.now(), 1, payload)
        .validate();
    new StockEvent(UUID.randomUUID(), "inventory.stock_debited", id, Instant.now(), 2, payload)
        .validate();
    for (var event :
        List.of(
            new StockEvent(null, "inventory.stock_added", id, Instant.now(), 1, payload),
            new StockEvent(id, "inventory.stock_added", null, Instant.now(), 1, payload),
            new StockEvent(id, "inventory.stock_added", id, null, 1, payload),
            new StockEvent(id, "inventory.stock_added", id, Instant.now(), 0, payload),
            new StockEvent(id, "inventory.stock_added", id, Instant.now(), 1, null),
            new StockEvent(id, "other", id, Instant.now(), 1, payload),
            new StockEvent(
                id, "inventory.stock_added", UUID.randomUUID(), Instant.now(), 1, payload),
            new StockEvent(
                id,
                "inventory.stock_added",
                id,
                Instant.now(),
                1,
                new Stock(id, -1, Instant.now())),
            new StockEvent(
                id, "inventory.stock_added", id, Instant.now(), 1, new Stock(id, 1, null))))
      assertThrows(IllegalArgumentException.class, event::validate);
  }
}
