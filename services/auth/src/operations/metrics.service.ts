import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';
import { BuildInfoService } from './build-info.service';

const KNOWN_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const KNOWN_ROUTES = [
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/version',
  '/health',
];

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  private readonly requests: Counter;
  private readonly duration: Histogram;

  constructor(config: ConfigService, build: BuildInfoService) {
    this.registry.setDefaultLabels({
      service: 'auth-service',
      environment: config.get<string>('APP_ENV', 'local'),
    });
    collectDefaultMetrics({ register: this.registry });
    this.requests = new Counter({
      name: 'http_requests_total',
      help: 'Respostas HTTP',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
    this.duration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duração HTTP',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 10],
      registers: [this.registry],
    });
    new Gauge({
      name: 'auth_build_info',
      help: 'Identidade da imagem',
      labelNames: ['version', 'commit'],
      registers: [this.registry],
    }).set({ ...build.get() }, 1);
  }

  record(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      if (req.path === '/metrics') return;
      const routePath: unknown = req.route?.path;
      const labels = {
        method: KNOWN_METHODS.includes(req.method) ? req.method : 'OTHER',
        route:
          typeof routePath === 'string' && KNOWN_ROUTES.includes(routePath)
            ? routePath
            : 'unmatched',
        status: String(res.statusCode),
      };
      this.requests.inc(labels);
      this.duration.observe(
        labels,
        Number(process.hrtime.bigint() - start) / 1e9,
      );
    });
    next();
  }
}
