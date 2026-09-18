package br.com.delivery.inventory.application.ports;

import br.com.delivery.inventory.domain.StockEvent;

public interface StockEventPublisher {
  void publish(StockEvent event);
}
