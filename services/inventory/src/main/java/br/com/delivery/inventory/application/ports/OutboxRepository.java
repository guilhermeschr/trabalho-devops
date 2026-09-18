package br.com.delivery.inventory.application.ports;

import br.com.delivery.inventory.domain.StockEvent;
import java.util.List;
import java.util.UUID;

public interface OutboxRepository {
  List<StockEvent> findPending(int limit);

  void markPublished(UUID eventId);

  void markFailed(UUID eventId, String reason);
}
