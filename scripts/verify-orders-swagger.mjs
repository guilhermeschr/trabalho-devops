import assert from 'node:assert/strict';
const base = (
  process.env.SWAGGER_BASE_URL ?? 'http://localhost:8080/orders'
).replace(/\/$/u, '');
const json = await fetch(`${base}/docs-json`);
assert.equal(json.status, 200, `HTTP ${json.status} em ${base}/docs-json`);
const doc = await json.json();
assert.equal(doc.info?.title, 'Delivery - Microsserviço de Pedidos');
assert.deepEqual(Object.keys(doc.paths).sort(), [
  '/api/v1/orders',
  '/api/v1/orders/{id}',
  '/api/v1/orders/{id}/complete',
  '/health',
]);
assert.equal(doc.components?.securitySchemes?.jwt?.scheme, 'bearer');
for (const [path, method, tag, statuses, body, secured] of [
  ['/api/v1/orders', 'post', 'Pedidos', [201, 400, 401, 404, 409, 500, 503], 'CreateOrderDto', true],
  ['/api/v1/orders/{id}', 'get', 'Pedidos', [200, 400, 401, 403, 404, 500], undefined, true],
  ['/api/v1/orders/{id}/complete', 'post', 'Pedidos', [200, 400, 401, 403, 404, 409, 500], undefined, true],
  ['/health', 'get', 'Infraestrutura', [200], undefined, false],
]) {
  const op = doc.paths[path]?.[method];
  assert.ok(op, `Operação ausente: ${method.toUpperCase()} ${path}`);
  assert.ok(op.tags?.includes(tag), `Tag ${tag} ausente em ${path}`);
  for (const status of statuses)
    assert.ok(op.responses[status], `Resposta ${status} ausente em ${path}`);
  if (secured)
    assert.ok(
      op.security?.some((item) => 'jwt' in item),
      `${path} deveria exigir JWT`,
    );
  else assert.ok(!op.security?.length, `${path} deveria ser pública`);
  if (body)
    assert.equal(
      op.requestBody?.content?.['application/json']?.schema?.$ref,
      `#/components/schemas/${body}`,
      `Corpo JSON ausente em ${path}`,
    );
  if (path.includes('{id}'))
    assert.ok(
      op.parameters?.some((p) => p.name === 'id' && p.in === 'path'),
      `Parâmetro id ausente em ${path}`,
    );
}
const complete = doc.paths['/api/v1/orders/{id}/complete'].post;
assert.ok(!complete.responses['201'], 'Conclusão deve responder 200');
assert.ok(!complete.requestBody, 'Conclusão não possui corpo');
for (const schema of [
  'CreateOrderDto',
  'OrderResponseDto',
  'ErrorResponseDto',
  'HealthResponseDto',
])
  assert.ok(doc.components.schemas[schema], `Schema ${schema} ausente`);
assert.ok(
  !('userId' in (doc.components.schemas.CreateOrderDto.properties ?? {})),
  'CreateOrderDto não pode receber userId',
);
const ui = await fetch(`${base}/docs`);
assert.equal(ui.status, 200, `HTTP ${ui.status} em ${base}/docs`);
assert.match(await ui.text(), /swagger-ui/i);
const init = await fetch(`${base}/docs/swagger-ui-init.js`);
assert.equal(init.status, 200, 'Recursos da interface Swagger inacessíveis');
console.log(`Swagger de Pedidos validado em ${base}`);
