// Run via npm run verify:flow (isolated container) or directly from the host.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const gateway = (process.env.GATEWAY_URL ?? 'http://localhost:8080').replace(
  /\/$/u,
  '',
);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(method, path, body, token) {
  const response = await fetch(gateway + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': `verify-flow-${randomUUID()}`,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    value = text;
  }
  return { status: response.status, body: value };
}

async function poll(description, check) {
  let last;
  for (let i = 0; i < 60; i++) {
    last = await check();
    if (last.done) return last.value;
    await pause(250);
  }
  throw new Error(
    `${description} não convergiu: ${JSON.stringify(last?.value ?? null)}`,
  );
}

async function main() {
  const email = `fluxo-${randomUUID()}@example.com`;
  const password = 'SenhaSegura123';

  const register = await api('POST', '/api/v1/auth/register', {
    name: 'Fluxo Completo',
    email,
    password,
  });
  assert.equal(register.status, 201, JSON.stringify(register.body));
  assert.equal(register.body.email, email);
  assert.equal(register.body.password, undefined);

  const login = await api('POST', '/api/v1/auth/login', { email, password });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.tokenType, 'Bearer');
  assert.equal(login.body.user.id, register.body.id);
  const token = login.body.accessToken;
  assert.ok(token, 'accessToken ausente no login');

  const product = await api(
    'POST',
    '/api/v1/products',
    {
      name: `Hambúrguer fluxo ${randomUUID()}`,
      description: 'Produto criado pelo roteiro de fluxo completo',
      price: 34.9,
      active: true,
    },
    token,
  );
  assert.equal(product.status, 201, JSON.stringify(product.body));
  const productId = product.body.id;

  const stock = await api(
    'POST',
    '/api/v1/inventory',
    { productId, quantity: 20 },
    token,
  );
  assert.equal(stock.status, 200, JSON.stringify(stock.body));
  assert.equal(stock.body.availableQuantity, 20);

  await poll('Projeção de produto', async () => {
    const result = await api(
      'GET',
      '/api/v1/products?id=' + productId,
      undefined,
      token,
    );
    return {
      done:
        result.status === 200 &&
        result.body.length === 1 &&
        result.body[0].price === 34.9,
      value: result,
    };
  });

  const projectedStock = (quantity) =>
    poll(`Projeção de estoque (${quantity})`, async () => {
      const result = await api(
        'GET',
        '/api/v1/inventory/' + productId,
        undefined,
        token,
      );
      return {
        done:
          result.status === 200 && result.body.availableQuantity === quantity,
        value: result,
      };
    });
  await projectedStock(20);

  assert.equal(
    (await api('POST', '/api/v1/orders', { productId, quantity: 2 })).status,
    401,
  );
  const order = await api(
    'POST',
    '/api/v1/orders',
    { productId, quantity: 2 },
    token,
  );
  assert.equal(order.status, 201, JSON.stringify(order.body));
  assert.equal(order.body.status, 'CREATED');
  assert.equal(order.body.userId, register.body.id);
  assert.equal(order.body.productId, productId);
  assert.equal(order.body.unitPrice, 34.9);
  assert.equal(order.body.total, 69.8);
  const orderId = order.body.id;

  const fetched = await api(
    'GET',
    '/api/v1/orders/' + orderId,
    undefined,
    token,
  );
  assert.equal(fetched.status, 200, JSON.stringify(fetched.body));
  assert.deepEqual(fetched.body, order.body);

  const completed = await api(
    'POST',
    `/api/v1/orders/${orderId}/complete`,
    undefined,
    token,
  );
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  assert.equal(completed.body.status, 'COMPLETED');

  const repeated = await api(
    'POST',
    `/api/v1/orders/${orderId}/complete`,
    undefined,
    token,
  );
  assert.equal(repeated.status, 200, JSON.stringify(repeated.body));
  assert.deepEqual(repeated.body, completed.body);

  await projectedStock(18);

  console.log(
    'Fluxo validado pelo gateway: cadastro, login com JWT real, criação de produto, adição de estoque, projeções de produto e estoque, criação, consulta e conclusão idempotente do pedido e débito refletido na projeção.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
