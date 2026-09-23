import type { Request, Response } from 'express';
import { RequestIdMiddleware } from './request-id.middleware';

function run(headers: Record<string, string | string[]>) {
  const request = { headers } as unknown as Request;
  const setHeader = jest.fn();
  const next = jest.fn();

  new RequestIdMiddleware().use(
    request,
    { setHeader } as unknown as Response,
    next,
  );

  return { request, setHeader, next };
}

describe('RequestIdMiddleware', () => {
  it('preserva o X-Request-Id recebido', () => {
    const { request, setHeader, next } = run({ 'x-request-id': ' req-1 ' });

    expect(request.headers['x-request-id']).toBe('req-1');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-1');
    expect(next).toHaveBeenCalled();
  });

  it('gera um UUID quando o cabeçalho está ausente ou vazio', () => {
    const missing = run({});
    const empty = run({ 'x-request-id': '  ' });

    for (const { request } of [missing, empty]) {
      expect(request.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/u);
    }
  });
});
