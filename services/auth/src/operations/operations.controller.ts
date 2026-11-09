import {
  Controller,
  Get,
  Headers,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { BuildInfoService } from './build-info.service';
import { MetricsService } from './metrics.service';

export class VersionResponseDto {
  @ApiProperty({ example: 'auth-service' })
  service!: string;

  @ApiProperty({ example: '0.2.0' })
  version!: string;

  @ApiProperty({ example: 'a'.repeat(40) })
  commit!: string;

  @ApiProperty({ enum: ['local', 'dev', 'homol'] })
  environment!: string;
}

@ApiTags('Infraestrutura')
@Controller()
export class OperationsController {
  constructor(
    private readonly config: ConfigService,
    private readonly build: BuildInfoService,
    private readonly metrics: MetricsService,
  ) {}

  @Get('api/v1/auth/version')
  @ApiOperation({ summary: 'Consultar versão pública da imagem de Auth' })
  @ApiOkResponse({ type: VersionResponseDto })
  version(): VersionResponseDto {
    return {
      service: 'auth-service',
      ...this.build.get(),
      environment: this.config.get<string>('APP_ENV', 'local'),
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Coletar métricas Prometheus com token exclusivo' })
  @ApiBearerAuth('metrics')
  @ApiProduces('text/plain')
  @ApiOkResponse({
    description: 'Métricas no formato Prometheus',
    schema: { type: 'string' },
  })
  @ApiUnauthorizedResponse({
    description: 'Token de métricas ausente ou inválido',
  })
  async scrape(
    @Headers('authorization') authorization: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const token = this.config.get<string>('METRICS_TOKEN');
    const expected = Buffer.from(`Bearer ${token ?? ''}`);
    const received = Buffer.from(authorization ?? '');
    if (
      !token ||
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException('Token de métricas inválido');
    }
    response
      .type(this.metrics.registry.contentType)
      .send(await this.metrics.registry.metrics());
  }
}
