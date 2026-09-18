import {
  AddStockUseCase,
  DebitStockUseCase,
  GetStockUseCase,
} from './stock.use-cases';
describe('Casos de uso de estoque', () => {
  const stock = {
    productId: 'p',
    availableQuantity: 20,
    updatedAt: new Date(),
  };
  const repository = {
    add: jest.fn(),
    debit: jest.fn(),
    findById: jest.fn(),
    project: jest.fn(),
  };
  beforeEach(() => jest.resetAllMocks());
  it('adiciona e debita por interfaces injetadas', async () => {
    repository.add.mockResolvedValue(stock);
    repository.debit.mockResolvedValue({ remainingQuantity: 18 });
    await expect(
      new AddStockUseCase(repository).execute({ productId: 'p', quantity: 20 }),
    ).resolves.toEqual(stock);
    await expect(
      new DebitStockUseCase(repository).execute({
        productId: 'p',
        orderId: 'o',
        quantity: 2,
      }),
    ).resolves.toEqual({ remainingQuantity: 18 });
  });
  it('normaliza UUIDs para preservar locks e idempotência', async () => {
    await new AddStockUseCase(repository).execute({
      productId: 'ABC',
      quantity: 1,
    });
    await new DebitStockUseCase(repository).execute({
      productId: 'ABC',
      orderId: 'DEF',
      quantity: 1,
    });
    expect(repository.add).toHaveBeenCalledWith({
      productId: 'abc',
      quantity: 1,
    });
    expect(repository.debit).toHaveBeenCalledWith({
      productId: 'abc',
      orderId: 'def',
      quantity: 1,
    });
  });
  it.each([0, -1, 1.2, 2147483648, NaN])(
    'rejeita quantidade inválida %s',
    (quantity) => {
      expect(() =>
        new AddStockUseCase(repository).execute({ productId: 'p', quantity }),
      ).toThrow();
      expect(() =>
        new DebitStockUseCase(repository).execute({
          productId: 'p',
          orderId: 'o',
          quantity,
        }),
      ).toThrow();
      expect(repository.add).not.toHaveBeenCalled();
      expect(repository.debit).not.toHaveBeenCalled();
    },
  );
  it('consulta somente o repositório de leitura', async () => {
    repository.findById.mockResolvedValue(stock);
    await expect(new GetStockUseCase(repository).execute('p')).resolves.toEqual(
      stock,
    );
    repository.findById.mockResolvedValue(null);
    await expect(
      new GetStockUseCase(repository).execute('missing'),
    ).rejects.toMatchObject({ status: 404 });
  });
});
