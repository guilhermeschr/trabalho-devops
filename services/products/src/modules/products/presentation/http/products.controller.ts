import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../../common/swagger/error-response.dto';
import { CreateProductDto } from '../../application/dto/create-product.dto';
import { ListProductsQueryDto } from '../../application/dto/list-products.query.dto';
import { ProductResponseDto } from '../../application/dto/product-response.dto';
import { UpdateProductDto } from '../../application/dto/update-product.dto';
import { CreateProductUseCase } from '../../application/use-cases/create-product.use-case';
import { ListProductsUseCase } from '../../application/use-cases/list-products.use-case';
import { UpdateProductUseCase } from '../../application/use-cases/update-product.use-case';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { rethrowProductHttpError } from './product-http-error';

@Controller('api/v1/products')
@UseGuards(JwtAuthGuard)
@ApiTags('Produtos')
@ApiBearerAuth('jwt')
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiInternalServerErrorResponse({ type: ErrorResponseDto })
export class ProductsController {
  constructor(
    private readonly createProduct: CreateProductUseCase,
    private readonly updateProduct: UpdateProductUseCase,
    private readonly listProducts: ListProductsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Consultar todos os produtos' })
  @ApiQuery({
    name: 'id',
    required: false,
    type: String,
    format: 'uuid',
    description: 'Identificador UUID exato do produto',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Parte do nome, sem diferenciar maiúsculas',
  })
  @ApiOkResponse({ type: ProductResponseDto, isArray: true })
  async findAll(
    @Query() query: ListProductsQueryDto,
  ): Promise<ProductResponseDto[]> {
    const products = await this.listProducts.execute(query);
    return products.map((product) => ProductResponseDto.fromDomain(product));
  }

  @Post()
  @ApiOperation({ summary: 'Criar produto' })
  @ApiBody({
    type: CreateProductDto,
    examples: {
      produto: {
        summary: 'Produto válido',
        value: {
          name: 'Pizza Margherita',
          description: 'Pizza com molho de tomate e manjericão',
          price: 39.9,
          active: true,
        },
      },
    },
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  async create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.createProduct.execute(dto);
    return ProductResponseDto.fromDomain(product);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Editar produto' })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID do produto',
    format: 'uuid',
    example: '33eba94f-f9d2-4d91-bfc7-c272a9067304',
  })
  @ApiBody({ type: UpdateProductDto })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
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
}
