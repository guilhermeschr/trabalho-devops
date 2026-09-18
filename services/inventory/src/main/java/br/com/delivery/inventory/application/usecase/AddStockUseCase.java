package br.com.delivery.inventory.application.usecase;

import br.com.delivery.inventory.application.ports.StockWriteRepository;
import br.com.delivery.inventory.domain.*;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class AddStockUseCase {
  private final StockWriteRepository repository;

  public AddStockUseCase(StockWriteRepository repository) {
    this.repository = repository;
  }

  public Stock execute(UUID productId, Integer quantity) {
    StockRules.validateQuantity(quantity);
    return repository.add(productId, quantity);
  }
}
