import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ProductResponseDto } from '../../application/dto/product-response.dto';
import { GetProductUseCase } from '../../application/use-cases/get-product.use-case';
import { InternalTokenGuard } from '../../infrastructure/auth/internal-token.guard';
import { rethrowProductHttpError } from './product-http-error';

@Controller('internal/v1/products')
@UseGuards(InternalTokenGuard)
export class InternalProductsController {
  constructor(private readonly getProduct: GetProductUseCase) {}

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProductResponseDto> {
    try {
      const product = await this.getProduct.execute(id);
      return ProductResponseDto.fromDomain(product);
    } catch (error) {
      rethrowProductHttpError(error);
    }
  }
}
