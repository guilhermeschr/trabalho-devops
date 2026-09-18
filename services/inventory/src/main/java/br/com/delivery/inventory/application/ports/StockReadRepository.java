package br.com.delivery.inventory.application.ports;

import br.com.delivery.inventory.domain.*;
import java.util.Optional;
import java.util.UUID;

public interface StockReadRepository {
  Optional<Stock> findById(UUID productId);

  void project(StockEvent event);
}
