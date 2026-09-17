const baseUrl = (process.env.SWAGGER_BASE_URL ?? 'http://localhost:8080').replace(
  /\/$/u,
  '',
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getOperation(document, path, method) {
  const operation = document.paths?.[path]?.[method];
  assert(operation, `Operação ausente: ${method.toUpperCase()} ${path}`);
  return operation;
}

function assertResponses(operation, path, method, statuses) {
  for (const status of statuses) {
    assert(
      operation.responses?.[status],
      `Resposta ${status} ausente em ${method.toUpperCase()} ${path}`,
    );
  }
}

function assertTag(operation, path, method, tag) {
  assert(
    operation.tags?.includes(tag),
    `Tag ${tag} ausente em ${method.toUpperCase()} ${path}`,
  );
}

async function main() {
  const response = await fetch(`${baseUrl}/docs-json`);
  assert(
    response.ok,
    `Swagger JSON retornou HTTP ${response.status} em ${baseUrl}/docs-json`,
  );

  const document = await response.json();
  assert(
    document.info?.title === 'Delivery - Microsserviço de Produtos',
    'Título do documento Swagger está incorreto',
  );
  assert(
    document.components?.securitySchemes?.jwt,
    'Esquema de autenticação JWT ausente',
  );

  const create = getOperation(document, '/api/v1/products', 'post');
  assertTag(create, '/api/v1/products', 'post', 'Produtos');
  assertResponses(create, '/api/v1/products', 'post', [
    '201',
    '400',
    '401',
    '500',
  ]);
  assert(
    create.security?.some((security) => security.jwt),
    'Autenticação JWT ausente na criação de produto',
  );
  assert(
    create.requestBody?.content?.['application/json'],
    'Corpo JSON ausente na criação de produto',
  );

  for (const method of ['get', 'put']) {
    const operation = getOperation(document, '/api/v1/products/{id}', method);
    assertTag(operation, '/api/v1/products/{id}', method, 'Produtos');
    assertResponses(operation, '/api/v1/products/{id}', method, [
      '200',
      '400',
      '401',
      '404',
      '500',
    ]);
    assert(
      operation.security?.some((security) => security.jwt),
      `Autenticação JWT ausente em ${method.toUpperCase()} /api/v1/products/{id}`,
    );
    assert(
      operation.parameters?.some(
        (parameter) =>
          parameter.name === 'id' &&
          parameter.in === 'path' &&
          parameter.required === true,
      ),
      `Parâmetro id ausente em ${method.toUpperCase()} /api/v1/products/{id}`,
    );
  }

  const internal = getOperation(
    document,
    '/internal/v1/products/{id}',
    'get',
  );
  assertTag(
    internal,
    '/internal/v1/products/{id}',
    'get',
    'Produtos internos',
  );
  assertResponses(internal, '/internal/v1/products/{id}', 'get', [
    '200',
    '403',
    '404',
    '500',
  ]);
  assert(
    internal.parameters?.some(
      (parameter) =>
        parameter.name === 'X-Internal-Token' &&
        parameter.in === 'header' &&
        parameter.required === true,
    ),
    'Header X-Internal-Token ausente na rota interna',
  );

  const health = getOperation(document, '/health', 'get');
  assertTag(health, '/health', 'get', 'Infraestrutura');
  assertResponses(health, '/health', 'get', ['200']);

  for (const schema of [
    'CreateProductDto',
    'UpdateProductDto',
    'ProductResponseDto',
    'ErrorResponseDto',
    'HealthResponseDto',
  ]) {
    assert(
      document.components?.schemas?.[schema],
      `Schema ${schema} ausente no documento Swagger`,
    );
  }

  console.log(`Swagger de Produtos validado em ${baseUrl}`);
}

main().catch((error) => {
  console.error(`Falha na validação do Swagger: ${error.message}`);
  process.exitCode = 1;
});
