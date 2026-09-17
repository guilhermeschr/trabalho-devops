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

  const list = getOperation(document, '/api/v1/products', 'get');
  assertTag(list, '/api/v1/products', 'get', 'Produtos');
  assertResponses(list, '/api/v1/products', 'get', ['200', '401', '500']);
  assert(
    list.security?.some((security) => security.jwt),
    'Autenticação JWT ausente na listagem de produtos',
  );
  assert(
    list.parameters?.some(
      (parameter) =>
        parameter.name === 'id' &&
        parameter.in === 'query' &&
        parameter.required === false &&
        parameter.schema?.type === 'string' &&
        parameter.schema?.format === 'uuid',
    ),
    'Filtro id ausente ou incorreto na listagem de produtos',
  );
  assert(
    list.parameters?.some(
      (parameter) =>
        parameter.name === 'name' &&
        parameter.in === 'query' &&
        parameter.required === false &&
        parameter.schema?.type === 'string',
    ),
    'Filtro name ausente ou incorreto na listagem de produtos',
  );
  const listSchema =
    list.responses?.['200']?.content?.['application/json']?.schema;
  assert(
    listSchema?.type === 'array' &&
      listSchema.items?.$ref === '#/components/schemas/ProductResponseDto',
    'Resposta da listagem de produtos não é um array de ProductResponseDto',
  );

  const update = getOperation(document, '/api/v1/products/{id}', 'put');
  assertTag(update, '/api/v1/products/{id}', 'put', 'Produtos');
  assertResponses(update, '/api/v1/products/{id}', 'put', [
    '200',
    '400',
    '401',
    '404',
    '500',
  ]);
  assert(
    update.security?.some((security) => security.jwt),
    'Autenticação JWT ausente em PUT /api/v1/products/{id}',
  );
  assert(
    update.parameters?.some(
      (parameter) =>
        parameter.name === 'id' &&
        parameter.in === 'path' &&
        parameter.required === true,
    ),
    'Parâmetro id ausente em PUT /api/v1/products/{id}',
  );
  assert(
    !document.paths?.['/api/v1/products/{id}']?.get,
    'GET /api/v1/products/{id} não deveria existir no Swagger',
  );

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
