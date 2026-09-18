package br.com.delivery.inventory.domain;

import java.time.Instant;
import java.util.UUID;

public record StockEvent(
    UUID eventId,
    String eventType,
    UUID aggregateId,
    Instant occurredAt,
    int version,
    Stock payload) {
  public void validate() {
    if (eventId == null
        || aggregateId == null
        || occurredAt == null
        || version < 1
        || payload == null
        || !aggregateId.equals(payload.productId())
        || payload.availableQuantity() < 0
        || payload.updatedAt() == null
        || !("inventory.stock_added".equals(eventType)
            || "inventory.stock_debited".equals(eventType)))
      throw new IllegalArgumentException("Evento de estoque inválido");
  }
}
