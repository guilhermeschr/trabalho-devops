import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DependencyName,
  DependencyUnavailableError,
} from '../../domain/order';
import { RequestContext } from '../../application/ports/orders.ports';

export const DEFAULT_TIMEOUT_MS = 3000;

export type InternalResponse = {
  status: number;
  body: unknown;
};

/**
 * Chamada REST síncrona para uma rota /internal/ de outro serviço, com
 * X-Internal-Token, X-Request-Id e timeout configurável. Timeout, falha de
 * rede e respostas 5xx viram DependencyUnavailableError (503).
 */
export async function callInternal(
  configService: ConfigService,
  logger: Logger,
  service: DependencyName,
  url: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
  context: RequestContext,
): Promise<InternalResponse> {
  const timeoutMs = Number(
    configService.get<string>('ORDERS_HTTP_TIMEOUT_MS', `${DEFAULT_TIMEOUT_MS}`),
  );
  const headers: Record<string, string> = {
    'X-Internal-Token': configService.getOrThrow<string>(
      'INTERNAL_SERVICE_TOKEN',
    ),
    'X-Request-Id': context.traceId,
  };
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(
        Number.isFinite(timeoutMs) && timeoutMs > 0
          ? timeoutMs
          : DEFAULT_TIMEOUT_MS,
      ),
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'TimeoutError'
        ? 'timeout'
        : 'falha de conexão';
    logger.warn(
      `Dependência indisponível service=${service} reason=${reason} traceId=${context.traceId}`,
    );
    throw new DependencyUnavailableError(service);
  }

  if (response.status >= 500) {
    logger.warn(
      `Dependência indisponível service=${service} reason=HTTP ${response.status} traceId=${context.traceId}`,
    );
    throw new DependencyUnavailableError(service);
  }

  return { status: response.status, body: await readJson(response) };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** Resposta que Pedidos não sabe tratar: erro de configuração, nunca do cliente. */
export function unexpectedResponse(
  logger: Logger,
  service: DependencyName,
  response: InternalResponse,
  context: RequestContext,
): Error {
  const code =
    typeof response.body === 'object' && response.body !== null
      ? (response.body as { code?: unknown }).code
      : undefined;
  logger.error(
    `Resposta inesperada service=${service} status=${response.status} code=${String(code)} traceId=${context.traceId}`,
  );
  return new Error(`Resposta inesperada de ${service}: HTTP ${response.status}`);
}

export function baseUrl(
  configService: ConfigService,
  key: string,
  fallback: string,
): string {
  return configService.get<string>(key, fallback).replace(/\/+$/u, '');
}
