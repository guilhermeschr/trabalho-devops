import { Logger } from '@nestjs/common';
import {
  DependencyUnavailableError,
  InsufficientStockError,
  InvalidOrderStatusError,
  Order,
  OrderForbiddenError,
  OrderNotFoundError,
  OrderStatus,
  ProductInactiveError,
  ProductNotFoundError,
} from '../../domain/order';
import {
  InventoryClient,
  OrderRepository,
  ProductsClient,
} from '../ports/orders.ports';
import { CompleteOrderUseCase } from './complete-order.use-case';
import { CreateOrderUseCase } from './create-order.use-case';
import { GetOrderUseCase } from './get-order.use-case';

const USER_ID = '9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01';
const OTHER_USER_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20';
const ORDER_ID = 'd3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc';
const context = { traceId: 'req-1' };

function storedOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID,
    userId: USER_ID,
    productId: PRODUCT_ID,
    quantity: 2,
    unitPrice: 34.9,
    total: 69.8,
    status: OrderStatus.CREATED,
    createdAt: new Date('2026-09-16T15:20:00.000Z'),
    updatedAt: new Date('2026-09-16T15:20:00.000Z'),
    ...overrides,
  };
}

function mocks() {
  const repository: jest.Mocked<OrderRepository> = {
    create: jest.fn(async (order: Order) => order),
    findById: jest.fn(),
    complete: jest.fn(),
  };
  const products: jest.Mocked<ProductsClient> = {
    getProduct: jest.fn().mockResolvedValue({
      id: PRODUCT_ID,
      price: 34.9,
      active: true,
    }),
  };
  const inventory: jest.Mocked<InventoryClient> = {
    debit: jest.fn().mockResolvedValue(undefined),
  };
  return { repository, products, inventory };
}

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());

describe('CreateOrderUseCase', () => {
  const input = { userId: USER_ID, productId: PRODUCT_ID, quantity: 2 };

  it('cria pedido CREATED com preço consultado e total calculado', async () => {
    const { repository, products, inventory } = mocks();
    const useCase = new CreateOrderUseCase(repository, products, inventory);

    const order = await useCase.execute(input, context);

    expect(order).toEqual(
      expect.objectContaining({
        userId: USER_ID,
        productId: PRODUCT_ID,
        quantity: 2,
        unitPrice: 34.9,
        total: 69.8,
        status: OrderStatus.CREATED,
      }),
    );
    expect(order.id).toMatch(/^[0-9a-f-]{36}$/u);
    expect(products.getProduct).toHaveBeenCalledWith(PRODUCT_ID, context);
    expect(inventory.debit).toHaveBeenCalledWith(
      { orderId: order.id, productId: PRODUCT_ID, quantity: 2 },
      context,
    );
    expect(repository.create).toHaveBeenCalledWith(order);
  });

  it('grava o preço vindo de Produtos, nunca do cliente', async () => {
    const { repository, products, inventory } = mocks();
    products.getProduct.mockResolvedValue({
      id: PRODUCT_ID,
      price: 12.5,
      active: true,
    });

    await new CreateOrderUseCase(repository, products, inventory).execute(
      { ...input, quantity: 3 },
      context,
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ unitPrice: 12.5, total: 37.5 }),
    );
  });

  it('rejeita produto inexistente sem debitar estoque', async () => {
    const { repository, products, inventory } = mocks();
    products.getProduct.mockRejectedValue(new ProductNotFoundError());

    await expect(
      new CreateOrderUseCase(repository, products, inventory).execute(
        input,
        context,
      ),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(inventory.debit).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejeita produto inativo sem debitar estoque', async () => {
    const { repository, products, inventory } = mocks();
    products.getProduct.mockResolvedValue({
      id: PRODUCT_ID,
      price: 34.9,
      active: false,
    });

    await expect(
      new CreateOrderUseCase(repository, products, inventory).execute(
        input,
        context,
      ),
    ).rejects.toBeInstanceOf(ProductInactiveError);
    expect(inventory.debit).not.toHaveBeenCalled();
  });

  it('propaga falha do cliente REST de Produtos', async () => {
    const { repository, products, inventory } = mocks();
    products.getProduct.mockRejectedValue(
      new DependencyUnavailableError('products-service'),
    );

    await expect(
      new CreateOrderUseCase(repository, products, inventory).execute(
        input,
        context,
      ),
    ).rejects.toEqual(
      expect.objectContaining({ service: 'products-service' }),
    );
    expect(inventory.debit).not.toHaveBeenCalled();
  });

  it('propaga falha do cliente REST de Estoque sem gravar pedido', async () => {
    const { repository, products, inventory } = mocks();
    inventory.debit.mockRejectedValue(
      new DependencyUnavailableError('inventory-service'),
    );

    await expect(
      new CreateOrderUseCase(repository, products, inventory).execute(
        input,
        context,
      ),
    ).rejects.toEqual(
      expect.objectContaining({ service: 'inventory-service' }),
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('propaga estoque insuficiente sem gravar pedido', async () => {
    const { repository, products, inventory } = mocks();
    inventory.debit.mockRejectedValue(new InsufficientStockError());

    await expect(
      new CreateOrderUseCase(repository, products, inventory).execute(
        input,
        context,
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('repete a gravação uma vez após o débito com o mesmo orderId', async () => {
    const { repository, products, inventory } = mocks();
    repository.create
      .mockRejectedValueOnce(new Error('conexão perdida'))
      .mockImplementationOnce(async (order) => order);

    const order = await new CreateOrderUseCase(
      repository,
      products,
      inventory,
    ).execute(input, context);

    expect(repository.create).toHaveBeenCalledTimes(2);
    expect(repository.create.mock.calls[1]?.[0].id).toBe(order.id);
    expect(inventory.debit).toHaveBeenCalledTimes(1);
  });

  it('registra orderId e traceId quando a gravação falha definitivamente', async () => {
    const { repository, products, inventory } = mocks();
    const failure = new Error('banco indisponível');
    repository.create.mockRejectedValue(failure);
    const logError = jest.spyOn(Logger.prototype, 'error');

    await expect(
      new CreateOrderUseCase(repository, products, inventory).execute(
        input,
        context,
      ),
    ).rejects.toBe(failure);
    expect(repository.create).toHaveBeenCalledTimes(2);
    const orderId = inventory.debit.mock.calls[0]?.[0].orderId;
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining(`orderId=${orderId} traceId=req-1`),
    );
  });
});

describe('GetOrderUseCase', () => {
  it('retorna pedido próprio', async () => {
    const { repository } = mocks();
    repository.findById.mockResolvedValue(storedOrder());

    await expect(
      new GetOrderUseCase(repository).execute(ORDER_ID, USER_ID),
    ).resolves.toEqual(storedOrder());
  });

  it('impede consulta de pedido de outro usuário', async () => {
    const { repository } = mocks();
    repository.findById.mockResolvedValue(storedOrder());

    await expect(
      new GetOrderUseCase(repository).execute(ORDER_ID, OTHER_USER_ID),
    ).rejects.toBeInstanceOf(OrderForbiddenError);
  });

  it('retorna erro para pedido inexistente', async () => {
    const { repository } = mocks();
    repository.findById.mockResolvedValue(null);

    await expect(
      new GetOrderUseCase(repository).execute(ORDER_ID, USER_ID),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});

describe('CompleteOrderUseCase', () => {
  it('conclui pedido próprio CREATED', async () => {
    const { repository } = mocks();
    const completed = storedOrder({ status: OrderStatus.COMPLETED });
    repository.findById.mockResolvedValue(storedOrder());
    repository.complete.mockResolvedValue(completed);

    await expect(
      new CompleteOrderUseCase(repository).execute(ORDER_ID, USER_ID),
    ).resolves.toBe(completed);
    expect(repository.complete).toHaveBeenCalledWith(ORDER_ID, expect.any(Date));
  });

  it('impede conclusão por outro usuário', async () => {
    const { repository } = mocks();
    repository.findById.mockResolvedValue(storedOrder());

    await expect(
      new CompleteOrderUseCase(repository).execute(ORDER_ID, OTHER_USER_ID),
    ).rejects.toBeInstanceOf(OrderForbiddenError);
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it('retorna erro para pedido inexistente', async () => {
    const { repository } = mocks();
    repository.findById.mockResolvedValue(null);

    await expect(
      new CompleteOrderUseCase(repository).execute(ORDER_ID, USER_ID),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it('conclusão repetida retorna o pedido sem nova alteração', async () => {
    const { repository } = mocks();
    const completed = storedOrder({ status: OrderStatus.COMPLETED });
    repository.findById.mockResolvedValue(completed);

    await expect(
      new CompleteOrderUseCase(repository).execute(ORDER_ID, USER_ID),
    ).resolves.toBe(completed);
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it('conclusão concorrente devolve o estado já concluído', async () => {
    const { repository } = mocks();
    const completed = storedOrder({ status: OrderStatus.COMPLETED });
    repository.findById
      .mockResolvedValueOnce(storedOrder())
      .mockResolvedValueOnce(completed);
    repository.complete.mockResolvedValue(null);

    await expect(
      new CompleteOrderUseCase(repository).execute(ORDER_ID, USER_ID),
    ).resolves.toBe(completed);
  });

  it('rejeita transição de status inválida', async () => {
    const { repository } = mocks();
    repository.findById.mockResolvedValue(
      storedOrder({ status: 'CANCELLED' as OrderStatus }),
    );

    await expect(
      new CompleteOrderUseCase(repository).execute(ORDER_ID, USER_ID),
    ).rejects.toBeInstanceOf(InvalidOrderStatusError);
    expect(repository.complete).not.toHaveBeenCalled();
  });
});
