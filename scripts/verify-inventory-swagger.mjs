import assert from 'node:assert/strict';
const base = (
  process.env.SWAGGER_BASE_URL ?? 'http://localhost:8080/inventory'
).replace(/\/$/u, '');
const json = await fetch(`${base}/docs-json`);
assert.equal(json.status, 200);
const doc = await json.json();
for (const [path, method, statuses] of [
  ['/api/v1/inventory', 'post', [200, 400, 401, 409, 500]],
  ['/api/v1/inventory/{productId}', 'get', [200, 400, 401, 404, 500]],
  ['/internal/v1/inventory/debit', 'post', [200, 400, 403, 409, 500]],
  ['/health', 'get', [200]],
]) {
  const op = doc.paths[path]?.[method];
  assert.ok(op, `${method} ${path}`);
  for (const status of statuses)
    assert.ok(op.responses[status], `Resposta ${status}: ${path}`);
  if (path.startsWith('/api/')) assert.ok(op.security.some((s) => s.jwt));
}
assert.ok(doc.components.securitySchemes.jwt);
assert.ok(
  doc.paths['/internal/v1/inventory/debit'].post.parameters.some(
    (p) => p.name === 'X-Internal-Token' && p.required,
  ),
);
assert.ok(
  doc.paths['/api/v1/inventory/{productId}'].get.parameters.some(
    (p) => p.name === 'productId' && p.schema.format === 'uuid',
  ),
);
for (const schema of [
  'AddStockDto',
  'DebitStockDto',
  'StockResponseDto',
  'DebitResponseDto',
  'ErrorResponseDto',
  'HealthResponseDto',
])
  assert.ok(doc.components.schemas[schema]);
const ui = await fetch(`${base}/docs`);
assert.equal(ui.status, 200);
assert.match(await ui.text(), /swagger-ui/i);
console.log(`Swagger de Estoque validado em ${base}`);
