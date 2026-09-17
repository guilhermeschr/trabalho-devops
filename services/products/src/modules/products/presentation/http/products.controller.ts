import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CreateProductDto } from '../../application/dto/create-product.dto';
import { ProductResponseDto } from '../../application/dto/product-response.dto';
import { UpdateProductDto } from '../../application/dto/update-product.dto';
import { CreateProductUseCase } from '../../application/use-cases/create-product.use-case';
import { GetProductUseCase } from '../../application/use-cases/get-product.use-case';
import { UpdateProductUseCase } from '../../application/use-cases/update-product.use-case';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { rethrowProductHttpError } from './product-http-error';

@Controller('api/v1/products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(
    private readonly createProduct: CreateProductUseCase,
    private readonly updateProduct: UpdateProductUseCase,
    private readonly getProduct: GetProductUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.createProduct.execute(dto);
    return ProductResponseDto.fromDomain(product);
  }

  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    try {
      const product = await this.updateProduct.execute(id, dto);
      return ProductResponseDto.fromDomain(product);
    } catch (error) {
      rethrowProductHttpError(error);
    }
  }

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
