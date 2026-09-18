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

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
        ? (exceptionResponse.message as string | string[])
        : exception instanceof Error
          ? exception.message
          : 'Erro interno do servidor';

    const body: ErrorResponse = {
      status,
      code:
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'code' in exceptionResponse
          ? String(exceptionResponse.code)
          : this.codeFor(status),
      message: status === 500 ? 'Erro interno do servidor' : message,
      timestamp: new Date().toISOString(),
      path: request.url,
      traceId: this.traceId(request),
    };

    response.status(status).json(body);
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
