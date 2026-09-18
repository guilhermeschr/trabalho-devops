import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiHeader,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
  AddStockUseCase,
  GetStockUseCase,
  DebitStockUseCase,
} from '../../application/use-cases/stock.use-cases';
import {
  AddStockDto,
  DebitStockDto,
  StockResponseDto,
  DebitResponseDto,
} from '../../application/dto/stock.dto';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { InternalTokenGuard } from '../../infrastructure/auth/internal-token.guard';
import { StockError } from '../../domain/stock';
import { ErrorResponseDto } from '../../../../common/swagger/error-response.dto';
async function respond<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof StockError)
      throw new HttpException(
        { code: error.code, message: error.message },
        error.status,
      );
    throw error;
  }
}
@Controller('api/v1/inventory')
@UseGuards(JwtAuthGuard)
@ApiTags('Estoque')
@ApiBearerAuth('jwt')
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiInternalServerErrorResponse({ type: ErrorResponseDto })
export class InventoryController {
  constructor(
    private readonly addStock: AddStockUseCase,
    private readonly getStock: GetStockUseCase,
  ) {}
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Criar ou adicionar estoque' })
  @ApiBody({ type: AddStockDto })
  @ApiOkResponse({ type: StockResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Limite de estoque excedido',
  })
  add(@Body() dto: AddStockDto) {
    return respond(() => this.addStock.execute(dto));
  }
  @Get(':productId')
  @ApiOperation({ summary: 'Consultar projeção de estoque' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiOkResponse({ type: StockResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  get(@Param('productId', new ParseUUIDPipe()) productId: string) {
    return respond(() => this.getStock.execute(productId));
  }
}
@Controller('internal/v1/inventory')
@UseGuards(InternalTokenGuard)
@ApiTags('Estoque interno')
@ApiHeader({
  name: 'X-Internal-Token',
  required: true,
  description: 'Token compartilhado entre serviços',
})
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiConflictResponse({
  type: ErrorResponseDto,
  description:
    'Estoque insuficiente ou orderId reutilizado com dados diferentes',
})
@ApiInternalServerErrorResponse({ type: ErrorResponseDto })
export class InternalInventoryController {
  constructor(private readonly debitStock: DebitStockUseCase) {}
  @Post('debit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Debitar estoque de forma idempotente por pedido' })
  @ApiBody({ type: DebitStockDto })
  @ApiOkResponse({ type: DebitResponseDto })
  debit(@Body() dto: DebitStockDto) {
    return respond(() => this.debitStock.execute(dto));
  }
}
