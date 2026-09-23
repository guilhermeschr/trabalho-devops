import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Garante um X-Request-Id por requisição para que o filtro de erros, os logs
 * e as chamadas a Produtos e Estoque usem o mesmo traceId.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const received = request.headers[REQUEST_ID_HEADER];
    const requestId =
      (typeof received === 'string' ? received.trim() : '') || randomUUID();

    request.headers[REQUEST_ID_HEADER] = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  }
}
