import { Inject, Injectable } from '@nestjs/common';
import {
  STOCK_WRITE_REPOSITORY,
  STOCK_READ_REPOSITORY,
} from '../ports/stock.tokens';
import {
  StockWriteRepository,
  StockReadRepository,
} from '../ports/stock.repositories';
import { AddStockInput, DebitStockInput, StockError } from '../../domain/stock';
function validate(input: AddStockInput) {
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 2147483647
  ) {
    throw new StockError(
      'VALIDATION_ERROR',
      'Quantidade deve ser um inteiro positivo até 2147483647',
      400,
    );
  }
}
@Injectable()
export class AddStockUseCase {
  constructor(
    @Inject(STOCK_WRITE_REPOSITORY)
    private readonly repository: StockWriteRepository,
  ) {}
  execute(input: AddStockInput) {
    validate(input);
    return this.repository.add({
      ...input,
      productId: input.productId.toLowerCase(),
    });
  }
}
@Injectable()
export class DebitStockUseCase {
  constructor(
    @Inject(STOCK_WRITE_REPOSITORY)
    private readonly repository: StockWriteRepository,
  ) {}
  execute(input: DebitStockInput) {
    validate(input);
    return this.repository.debit({
      ...input,
      productId: input.productId.toLowerCase(),
      orderId: input.orderId.toLowerCase(),
    });
  }
}
@Injectable()
export class GetStockUseCase {
  constructor(
    @Inject(STOCK_READ_REPOSITORY)
    private readonly repository: StockReadRepository,
  ) {}
  async execute(productId: string) {
    const stock = await this.repository.findById(productId);
    if (!stock)
      throw new StockError('STOCK_NOT_FOUND', 'Estoque não encontrado', 404);
    return stock;
  }
}
