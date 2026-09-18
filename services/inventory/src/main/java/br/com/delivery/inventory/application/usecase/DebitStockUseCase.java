package br.com.delivery.inventory.application.usecase;

import br.com.delivery.inventory.application.ports.StockWriteRepository;
import br.com.delivery.inventory.domain.*;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class DebitStockUseCase {
  private final StockWriteRepository repository;

  public DebitStockUseCase(StockWriteRepository repository) {
    this.repository = repository;
  }

  public DebitResult execute(UUID orderId, UUID productId, Integer quantity) {
    StockRules.validateQuantity(quantity);
    return repository.debit(orderId, productId, quantity);
  }
}
