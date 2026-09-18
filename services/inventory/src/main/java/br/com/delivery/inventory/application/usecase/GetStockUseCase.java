package br.com.delivery.inventory.application.usecase;

import br.com.delivery.inventory.application.ports.StockReadRepository;
import br.com.delivery.inventory.domain.*;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class GetStockUseCase {
  private final StockReadRepository repository;

  public GetStockUseCase(StockReadRepository repository) {
    this.repository = repository;
  }

  public Stock execute(UUID productId) {

    return repository
        .findById(productId)
        .orElseThrow(() -> new StockException("STOCK_NOT_FOUND", "Estoque não encontrado", 404));
  }
}
