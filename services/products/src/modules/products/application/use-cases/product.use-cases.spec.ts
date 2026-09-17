import {
  Product,
  ProductNotFoundError,
} from '../../domain/product';
import {
  ProductReadRepository,
  ProductWriteRepository,
} from '../ports/product.repositories';
import { CreateProductUseCase } from './create-product.use-case';
import { GetProductUseCase } from './get-product.use-case';
import { UpdateProductUseCase } from './update-product.use-case';

const product: Product = {
  id: '2f6f0d8e-7145-4b4c-8b7d-8f7db7d8d9b6',
  name: 'Pizza',
  description: 'Pizza de queijo',
  price: 39.9,
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('casos de uso de Produto', () => {
  it('cria produto usando ativo como verdadeiro por padrão', async () => {
    const repository: ProductWriteRepository = {
      create: jest.fn().mockResolvedValue(product),
      update: jest.fn(),
    };
    const useCase = new CreateProductUseCase(repository);

    await useCase.execute({
      name: product.name,
      description: product.description,
      price: product.price,
    });

    expect(repository.create).toHaveBeenCalledWith({
      name: product.name,
      description: product.description,
      price: product.price,
      active: true,
    });
  });

  it('edita produto delegando o comando ao repositório de escrita', async () => {
    const repository: ProductWriteRepository = {
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(product),
    };
    const useCase = new UpdateProductUseCase(repository);
    const input = {
      name: 'Pizza grande',
      description: null,
      price: 49.9,
      active: true,
    };

    await expect(useCase.execute(product.id, input)).resolves.toBe(product);
    expect(repository.update).toHaveBeenCalledWith(product.id, input);
  });

  it('consulta produto no repositório de leitura', async () => {
    const repository: ProductReadRepository = {
      findById: jest.fn().mockResolvedValue(product),
      upsertProjection: jest.fn(),
    };
    const useCase = new GetProductUseCase(repository);

    await expect(useCase.execute(product.id)).resolves.toBe(product);
    expect(repository.findById).toHaveBeenCalledWith(product.id);
  });

  it('informa quando o produto não existe na projeção', async () => {
    const repository: ProductReadRepository = {
      findById: jest.fn().mockResolvedValue(null),
      upsertProjection: jest.fn(),
    };
    const useCase = new GetProductUseCase(repository);

    await expect(useCase.execute(product.id)).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
  });
});
