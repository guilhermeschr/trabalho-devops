import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpErrorFilter } from './http-error.filter';

function hostFor(headers: Record<string, string> = {}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        url: '/api/v1/orders',
        header: (name: string) => headers[name.toLowerCase()],
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpErrorFilter', () => {
  const filter = new HttpErrorFilter();

  it('usa X-Request-Id como traceId e mantém mensagens de validação', () => {
    const { host, status, json } = hostFor({ 'x-request-id': 'req-8f82c4' });

    filter.catch(new BadRequestException(['quantity must not be less than 1']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: ['quantity must not be less than 1'],
        path: '/api/v1/orders',
        traceId: 'req-8f82c4',
      }),
    );
  });

  it('gera traceId quando o cabeçalho não é enviado', () => {
    const { host, json } = hostFor();

    filter.catch(new NotFoundException(), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'NOT_FOUND',
        traceId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      }),
    );
  });

  it('mantém código informado pela exceção e usa mensagem textual', () => {
    const { host, json } = hostFor();

    filter.catch(new HttpException('Conflito', 409), host);
    filter.catch(new HttpException({ code: 'CUSTOM', message: 'x' }, 418), host);

    expect(json).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ code: 'CONFLICT', message: 'Conflito' }),
    );
    expect(json).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 418, code: 'CUSTOM', message: 'x' }),
    );
  });

  it('mantém a mensagem de 503 e oculta detalhes dos demais erros 5xx', () => {
    const { host, status, json } = hostFor();

    filter.catch(
      new ServiceUnavailableException('Serviço de Estoque indisponível'),
      host,
    );
    filter.catch(new Error('stack com segredo'), host);
    filter.catch(new HttpException('detalhe interno', 502), host);

    expect(status).toHaveBeenNthCalledWith(1, 503);
    expect(status).toHaveBeenNthCalledWith(2, 500);
    expect(json).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Serviço de Estoque indisponível',
      }),
    );
    expect(json).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ message: 'Erro interno do servidor' }),
    );
    expect(json).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Erro interno do servidor',
      }),
    );
  });
});
