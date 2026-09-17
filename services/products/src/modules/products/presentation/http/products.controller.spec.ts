import { NotFoundException } from '@nestjs/common';
import { CreateProductDto } from '../../application/dto/create-product.dto';
import { ListProductsQueryDto } from '../../application/dto/list-products.query.dto';
import { UpdateProductDto } from '../../application/dto/update-product.dto';
import { ProductNotFoundError } from '../../domain/product';
import { CreateProductUseCase } from '../../application/use-cases/create-product.use-case';
import { GetProductUseCase } from '../../application/use-cases/get-product.use-case';
import { ListProductsUseCase } from '../../application/use-cases/list-products.use-case';
import { UpdateProductUseCase } from '../../application/use-cases/update-product.use-case';
import { InternalProductsController } from './internal-products.controller';
import { ProductsController } from './products.controller';

const product = {
  id: '2f6f0d8e-7145-4b4c-8b7d-8f7db7d8d9b6',
  name: 'Pizza',
  description: null,
  price: 39.9,
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('controllers HTTP de Produto', () => {
  it('cria e transforma o produto na resposta pública', async () => {
    const create = {
      execute: jest.fn().mockResolvedValue(product),
    } as unknown as CreateProductUseCase;
    const update = {} as UpdateProductUseCase;
    const list = {} as ListProductsUseCase;
    const controller = new ProductsController(create, update, list);
    const dto = {
      name: 'Pizza',
      price: 39.9,
    } as CreateProductDto;

    await expect(controller.create(dto)).resolves.toMatchObject({
      id: product.id,
      name: product.name,
    });
    expect(create.execute).toHaveBeenCalledWith(dto);
  });

  it('edita produto', async () => {
    const update = {
      execute: jest.fn().mockResolvedValue(product),
    } as unknown as UpdateProductUseCase;
    const controller = new ProductsController(
      {} as CreateProductUseCase,
      update,
      {} as ListProductsUseCase,
    );
    const dto = {
      name: 'Pizza',
      price: 39.9,
      active: true,
    } as UpdateProductDto;

    await expect(controller.update(product.id, dto)).resolves.toMatchObject({
      id: product.id,
    });
  });

  it('lista produtos e transforma a resposta para o contrato HTTP', async () => {
    const list = {
      execute: jest.fn().mockResolvedValue([product]),
    } as unknown as ListProductsUseCase;
    const controller = new ProductsController(
      {} as CreateProductUseCase,
      {} as UpdateProductUseCase,
      list,
    );

    await expect(controller.findAll({})).resolves.toEqual([
      expect.objectContaining({
        id: product.id,
        name: product.name,
        price: product.price,
      }),
    ]);
    expect(list.execute).toHaveBeenCalledTimes(1);
  });

  it('encaminha os filtros da consulta para o caso de uso', async () => {
    const list = {
      execute: jest.fn().mockResolvedValue([product]),
    } as unknown as ListProductsUseCase;
    const controller = new ProductsController(
      {} as CreateProductUseCase,
      {} as UpdateProductUseCase,
      list,
    );
    const query = {
      id: product.id,
      name: 'pizza',
    } as ListProductsQueryDto;

    await expect(controller.findAll(query)).resolves.toHaveLength(1);
    expect(list.execute).toHaveBeenCalledWith(query);
  });

  it('mapeia produto inexistente para 404', async () => {
    const missing = new ProductNotFoundError(product.id);
    const controller = new ProductsController(
      {} as CreateProductUseCase,
      {
        execute: jest.fn().mockRejectedValue(missing),
      } as unknown as UpdateProductUseCase,
      {} as ListProductsUseCase,
    );

    await expect(controller.update(product.id, {} as UpdateProductDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('mantém a consulta interna sob o mesmo caso de uso de leitura', async () => {
    const get = {
      execute: jest.fn().mockResolvedValue(product),
    } as unknown as GetProductUseCase;
    const controller = new InternalProductsController(get);

    await expect(controller.findOne(product.id)).resolves.toMatchObject({
      id: product.id,
    });
    expect(get.execute).toHaveBeenCalledWith(product.id);
  });
});
