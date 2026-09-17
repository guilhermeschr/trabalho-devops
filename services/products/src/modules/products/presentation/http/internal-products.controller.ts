import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../../common/swagger/error-response.dto';
import { ProductResponseDto } from '../../application/dto/product-response.dto';
import { GetProductUseCase } from '../../application/use-cases/get-product.use-case';
import { InternalTokenGuard } from '../../infrastructure/auth/internal-token.guard';
import { rethrowProductHttpError } from './product-http-error';

@Controller('internal/v1/products')
@UseGuards(InternalTokenGuard)
@ApiTags('Produtos internos')
export class InternalProductsController {
  constructor(private readonly getProduct: GetProductUseCase) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar produto para comunicação entre microsserviços',
    description:
      'Rota exclusiva para comunicação interna. Não é acessível através do gateway externo.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador UUID do produto',
    format: 'uuid',
    example: '33eba94f-f9d2-4d91-bfc7-c272a9067304',
  })
  @ApiHeader({
    name: 'X-Internal-Token',
    description: 'Token compartilhado entre microsserviços',
    required: true,
  })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiInternalServerErrorResponse({ type: ErrorResponseDto })
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
