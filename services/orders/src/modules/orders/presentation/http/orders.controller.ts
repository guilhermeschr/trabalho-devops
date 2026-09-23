import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../../common/swagger/error-response.dto';
import { CreateOrderDto } from '../../application/dto/create-order.dto';
import { OrderResponseDto } from '../../application/dto/order-response.dto';
import { CompleteOrderUseCase } from '../../application/use-cases/complete-order.use-case';
import { CreateOrderUseCase } from '../../application/use-cases/create-order.use-case';
import { GetOrderUseCase } from '../../application/use-cases/get-order.use-case';
import {
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
} from '../../infrastructure/auth/jwt-auth.guard';
import { rethrowOrderHttpError } from './orders-http-error';

const ORDER_ID_PARAM = {
  name: 'id',
  description: 'Identificador UUID do pedido',
  format: 'uuid',
  example: 'd3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc',
};

@Controller('api/v1/orders')
@UseGuards(JwtAuthGuard)
@ApiTags('Pedidos')
@ApiBearerAuth('jwt')
@ApiHeader({
  name: 'X-Request-Id',
  required: false,
  description:
    'Identificador de rastreio propagado a Produtos e Estoque; gerado quando ausente',
})
@ApiBadRequestResponse({
  type: ErrorResponseDto,
  description: 'Dados inválidos ou campos desconhecidos (VALIDATION_ERROR)',
})
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'JWT ausente ou inválido (UNAUTHORIZED)',
})
@ApiInternalServerErrorResponse({ type: ErrorResponseDto })
export class OrdersController {
  constructor(
    private readonly createOrder: CreateOrderUseCase,
    private readonly getOrder: GetOrderUseCase,
    private readonly completeOrder: CompleteOrderUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Criar pedido',
    description:
      'Consulta o produto em Produtos, debita o estoque em Estoque e grava o pedido com o preço consultado. O userId vem do claim sub do JWT.',
  })
  @ApiBody({
    type: CreateOrderDto,
    examples: {
      pedido: {
        summary: 'Pedido válido',
        value: {
          productId: '4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20',
          quantity: 2,
        },
      },
    },
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Produto inexistente (PRODUCT_NOT_FOUND)',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description:
      'Produto inativo (PRODUCT_INACTIVE) ou estoque insuficiente (INSUFFICIENT_STOCK)',
  })
  @ApiServiceUnavailableResponse({
    type: ErrorResponseDto,
    description:
      'Produtos ou Estoque indisponível ou sem resposta no timeout (DEPENDENCY_UNAVAILABLE)',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
    @Headers('x-request-id') traceId: string,
  ): Promise<OrderResponseDto> {
    try {
      const order = await this.createOrder.execute(
        { userId: user.userId, productId: dto.productId, quantity: dto.quantity },
        { traceId },
      );
      return OrderResponseDto.fromDomain(order);
    } catch (error) {
      rethrowOrderHttpError(error);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar pedido próprio' })
  @ApiParam(ORDER_ID_PARAM)
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Pedido de outro usuário (ORDER_FORBIDDEN)',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Pedido inexistente (ORDER_NOT_FOUND)',
  })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderResponseDto> {
    try {
      return OrderResponseDto.fromDomain(
        await this.getOrder.execute(id, user.userId),
      );
    } catch (error) {
      rethrowOrderHttpError(error);
    }
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Concluir pedido',
    description:
      'Transição CREATED → COMPLETED, somente pelo proprietário. A requisição não tem corpo; repetir a conclusão retorna 200 sem novas alterações.',
  })
  @ApiParam(ORDER_ID_PARAM)
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Pedido de outro usuário (ORDER_FORBIDDEN)',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Pedido inexistente (ORDER_NOT_FOUND)',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Status atual não permite conclusão (INVALID_ORDER_STATUS)',
  })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderResponseDto> {
    try {
      return OrderResponseDto.fromDomain(
        await this.completeOrder.execute(id, user.userId),
      );
    } catch (error) {
      rethrowOrderHttpError(error);
    }
  }
}
