import assert from 'node:assert/strict';
const base = (
  process.env.SWAGGER_BASE_URL ?? 'http://localhost:8080/auth'
).replace(/\/$/u, '');
const json = await fetch(`${base}/docs-json`);
assert.equal(json.status, 200, `HTTP ${json.status} em ${base}/docs-json`);
const doc = await json.json();
assert.equal(doc.info?.title, 'Delivery - Microsserviço de Auth');
assert.deepEqual(Object.keys(doc.paths).sort(), [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/health',
]);
for (const [path, method, tag, statuses, body] of [
  ['/api/v1/auth/register', 'post', 'Autenticação', [201, 400, 409, 500], 'RegisterUserDto'],
  ['/api/v1/auth/login', 'post', 'Autenticação', [200, 400, 401, 500], 'LoginDto'],
  ['/health', 'get', 'Infraestrutura', [200]],
]) {
  const op = doc.paths[path]?.[method];
  assert.ok(op, `Operação ausente: ${method.toUpperCase()} ${path}`);
  assert.ok(op.tags?.includes(tag), `Tag ${tag} ausente em ${path}`);
  for (const status of statuses)
    assert.ok(op.responses[status], `Resposta ${status} ausente em ${path}`);
  assert.ok(!op.security?.length, `${path} deveria ser pública`);
  if (body)
    assert.equal(
      op.requestBody?.content?.['application/json']?.schema?.$ref,
      `#/components/schemas/${body}`,
      `Corpo JSON ausente em ${path}`,
    );
}
assert.ok(!doc.paths['/api/v1/auth/login'].post.responses['201']);
for (const schema of [
  'RegisterUserDto',
  'LoginDto',
  'UserResponseDto',
  'LoginResponseDto',
  'ErrorResponseDto',
  'HealthResponseDto',
])
  assert.ok(doc.components.schemas[schema], `Schema ${schema} ausente`);
assert.ok(
  !JSON.stringify(doc.components.schemas.UserResponseDto).includes('password'),
  'UserResponseDto não pode expor senha',
);
const ui = await fetch(`${base}/docs`);
assert.equal(ui.status, 200, `HTTP ${ui.status} em ${base}/docs`);
assert.match(await ui.text(), /swagger-ui/i);
const init = await fetch(`${base}/docs/swagger-ui-init.js`);
assert.equal(init.status, 200, 'Recursos da interface Swagger inacessíveis');
console.log(`Swagger de Auth validado em ${base}`);
