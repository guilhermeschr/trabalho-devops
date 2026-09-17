import { validate } from 'class-validator';
import { CreateProductDto } from './create-product.dto';
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
});
