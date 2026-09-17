import {
  ArgumentsHost,
  BadRequestException,
} from '@nestjs/common';
import { HttpErrorFilter } from './http-error.filter';

function hostFor(request: { url: string; header: (name: string) => string | undefined }) {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost,
    response,
  };
}

describe('HttpErrorFilter', () => {
  it('padroniza erros HTTP e preserva o trace id recebido', () => {
    const { host, response } = hostFor({
      url: '/api/v1/products',
      header: () => 'trace-123',
    });

    new HttpErrorFilter().catch(
      new BadRequestException('dados inválidos'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'dados inválidos',
        path: '/api/v1/products',
        traceId: 'trace-123',
      }),
    );
  });

  it('usa resposta interna para exceção não HTTP e gera rastreamento', () => {
    const { host, response } = hostFor({
      url: '/health',
      header: () => undefined,
    });

    new HttpErrorFilter().catch(new Error('falha inesperada'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'falha inesperada',
        traceId: expect.any(String),
      }),
    );
  });
});
