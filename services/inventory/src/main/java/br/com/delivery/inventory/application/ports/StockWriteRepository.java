package br.com.delivery.inventory.application.ports;

import br.com.delivery.inventory.domain.*;
import java.util.UUID;

public interface StockWriteRepository {
  Stock add(UUID productId, int quantity);

  DebitResult debit(UUID orderId, UUID productId, int quantity);
}
