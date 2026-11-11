import { Injectable, MiddlewareConsumer, Module, NestModule, NestMiddleware } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BuildInfoService } from './build-info.service';
import { MetricsService } from './metrics.service';
import { OperationsController } from './operations.controller';
import type { Request, Response, NextFunction } from 'express';
@Injectable()
class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}
  use(req: Request, res: Response, next: NextFunction): void { this.metrics.record(req, res, next); }
}
@Module({ imports: [ConfigModule], controllers: [OperationsController], providers: [BuildInfoService, MetricsService] })
export class OperationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void { consumer.apply(MetricsMiddleware).forRoutes('*'); }
}

