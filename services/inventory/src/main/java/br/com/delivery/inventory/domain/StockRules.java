package br.com.delivery.inventory.domain;

import java.util.UUID;

/** Regras de negócio independentes de banco de dados e HTTP. */
public final class StockRules {
  private StockRules() {}

  public static void validateQuantity(Integer quantity) {
    if (quantity == null || quantity < 1)
      throw new StockException(
          "VALIDATION_ERROR", "Quantidade deve ser um inteiro positivo até 2147483647", 400);
  }

  public static int add(int balance, int quantity) {
    validateQuantity(quantity);
    long result = (long) balance + quantity;
    if (result > Integer.MAX_VALUE)
      throw new StockException("STOCK_LIMIT_EXCEEDED", "Limite de estoque excedido", 409);
    return (int) result;
  }

  public static int debit(int balance, int quantity) {
    validateQuantity(quantity);
    if (balance < quantity)
      throw new StockException(
          "INSUFFICIENT_STOCK", "Quantidade solicitada maior que o estoque disponível", 409);
    return balance - quantity;
  }

  public static DebitResult replay(DebitResult original, UUID productId, int quantity) {
    if (!original.productId().equals(productId) || original.debitedQuantity() != quantity)
      throw new StockException(
          "IDEMPOTENCY_CONFLICT", "Pedido já utilizado com dados diferentes", 409);
    return original;
  }
}
