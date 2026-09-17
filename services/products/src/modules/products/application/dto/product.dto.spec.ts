import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProductDto } from './create-product.dto';
import { ListProductsQueryDto } from './list-products.query.dto';
import { UpdateProductDto } from './update-product.dto';

describe('DTOs de Produto', () => {
  it('aceita produto válido', async () => {
    const dto = Object.assign(new CreateProductDto(), {
      name: 'Pizza',
      description: 'Pizza de queijo',
      price: 39.9,
      active: true,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejeita preço negativo e nome vazio', async () => {
    const dto = Object.assign(new UpdateProductDto(), {
      name: '',
      price: -1,
      active: true,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'price']),
    );
  });

  it('aceita filtros válidos e remove espaços do nome', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      id: '2f6f0d8e-7145-4b4c-8b7d-8f7db7d8d9b6',
      name: '  pizza  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.name).toBe('pizza');
  });

  it('rejeita id inválido e nome vazio nos filtros', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      id: 'produto-invalido',
      name: '   ',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['id', 'name']),
    );
  });
});
