import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

type ErrorResponse = {
  status: number;
  code: string;
  message: string | string[];
  timestamp: string;
  path: string;
  traceId: string;
};

const INTERNAL_ERROR_MESSAGE = 'Erro interno do servidor';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    if (!(exception instanceof HttpException)) {
      response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json(
          this.body(
            request,
            HttpStatus.INTERNAL_SERVER_ERROR,
            'INTERNAL_SERVER_ERROR',
            INTERNAL_ERROR_MESSAGE,
          ),
        );
      return;
    }

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const details =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as { message?: unknown; code?: unknown })
        : {};
    const message =
      typeof details.message === 'string' || Array.isArray(details.message)
        ? (details.message as string | string[])
        : exception.message;
    const code =
      typeof details.code === 'string' ? details.code : this.codeFor(status);

    response
      .status(status)
      .json(
        this.body(
          request,
          status,
          code,
          this.hidesDetails(status) ? INTERNAL_ERROR_MESSAGE : message,
        ),
      );
  }

  private body(
    request: Request,
    status: number,
    code: string,
    message: string | string[],
  ): ErrorResponse {
    return {
      status,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      traceId: this.traceId(request),
    };
  }

  /**
   * 503 identifica apenas qual dependência está indisponível; os demais 5xx
   * nunca expõem detalhes internos.
   */
  private hidesDetails(status: number): boolean {
    return status >= 500 && status !== HttpStatus.SERVICE_UNAVAILABLE;
  }

  private codeFor(status: number): string {
    const codes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'DEPENDENCY_UNAVAILABLE',
    };

    return codes[status] ?? 'INTERNAL_SERVER_ERROR';
  }

  private traceId(request: Request): string {
    const received =
      request.header('x-request-id') ?? request.header('x-trace-id');
    return received?.trim() || randomUUID();
  }
}
