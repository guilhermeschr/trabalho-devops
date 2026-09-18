# Trabalho DevOps

Sistema de delivery com microsserviços. Produtos e Estoque estão implementados.

## Requisitos locais

- Node.js 24 ou superior
- npm 11 ou superior
- Java 21 e Maven 3.9+ para executar/testar Estoque fora do Docker
- Docker com Docker Compose

## Execução do serviço de Produtos

Copie .env.example para .env e ajuste os valores somente para o ambiente local.

~~~bash
cp .env.example .env
npm install
npm run typecheck
npm run test:products
npm run infra:config
npm run infra:up
npm run verify:swagger:products
~~~

`npm run infra:up` carrega o `.env` da raiz e recria os containers para aplicar
alterações em `SWAGGER_ENABLED`. Depois de subir os serviços, confirme que o
container recebeu `SWAGGER_ENABLED=true` e valide os dois endpoints:

~~~bash
docker compose --env-file .env -f infra/docker/docker-compose.yml exec -T products-service sh -lc 'printf "SWAGGER_ENABLED=%s NODE_ENV=%s\\n" "$SWAGGER_ENABLED" "$NODE_ENV"'
curl -i http://localhost:8080/docs
curl -i http://localhost:8080/docs-json
~~~

`/docs` e `/docs-json` devem retornar HTTP 200 quando o Swagger estiver
habilitado. Consultar somente `/docs-json` não confirma que a interface está
abrindo corretamente.

O gateway local ficará disponível em http://localhost:8080.
O Swagger local ficará disponível em http://localhost:8080/docs e o documento
OpenAPI em http://localhost:8080/docs-json.

As rotas externas de Produtos são:

- `GET /api/v1/products` — consulta todos os produtos; aceita os filtros
  opcionais `id` (UUID exato) e `name` (nome parcial, sem diferenciar
  maiúsculas e minúsculas)
- `POST /api/v1/products`
- `PUT /api/v1/products/:id`

Exemplos de consulta:

~~~bash
curl --get 'http://localhost:8080/api/v1/products' --data-urlencode 'name=pizza'
curl --get 'http://localhost:8080/api/v1/products' --data-urlencode 'id=33eba94f-f9d2-4d91-bfc7-c272a9067304'
~~~

A consulta por ID existe somente em `/internal/v1/products/:id`, acessível
dentro da rede Docker com `X-Internal-Token`; o Nginx retorna 404 para
`/internal/`.

O ambiente inicial usa AUTH_ENABLED=false apenas para desenvolvimento local.
Em qualquer ambiente real, configure AUTH_ENABLED=true e um JWT_SECRET seguro.
O token de serviço interno deve ser diferente do segredo JWT.

O Swagger é habilitado no ambiente local por `SWAGGER_ENABLED=true`. Em
ambientes compartilhados ou de produção, configure `SWAGGER_ENABLED=false`.
As rotas internas aparecem documentadas, mas continuam bloqueadas pelo Nginx.
Os comandos npm de infraestrutura usam `--env-file .env` para carregar o `.env`
da raiz, mesmo com o arquivo Compose localizado em `infra/docker`.

Para gerar um JWT de desenvolvimento:

~~~bash
JWT_SECRET=change-me-in-development node scripts/generate-dev-jwt.mjs <usuario-id> dev@example.com
~~~

Comandos de operação:

~~~bash
npm run infra:up
npm run infra:down
docker compose --env-file .env -f infra/docker/docker-compose.yml ps
docker compose --env-file .env -f infra/docker/docker-compose.yml logs -f products-service
~~~

A implementação contém Produtos e Estoque, cada um com dois bancos CQRS,
RabbitMQ e o gateway Nginx. Auth e Pedidos serão adicionados posteriormente.


## Estoque — Java e Spring Boot

- `POST /api/v1/inventory`: `{ "productId": "<uuid>", "quantity": 20 }`.
- `GET /api/v1/inventory/:productId`: consulta o saldo projetado.
- `POST /internal/v1/inventory/debit`: `{ "orderId": "<uuid>", "productId": "<uuid>", "quantity": 2 }`, somente na rede interna com `X-Internal-Token`.

Rotas públicas sempre exigem `Authorization: Bearer <jwt>`, mesmo quando
`AUTH_ENABLED=false` para Produtos. Gere um JWT com o script descrito acima.
Débitos repetidos do mesmo pedido retornam a resposta original sem descontar
novamente; reutilizar o pedido com dados diferentes retorna 409.

Swagger de Estoque: http://localhost:8080/inventory/docs.

~~~bash
npm run test:inventory
npm run build:inventory
npm run verify:swagger:inventory
npm run verify:flow:inventory
~~~

O roteiro cria dados de teste. A especificação v2.0 descreve erros,
concorrência, consistência eventual e variáveis de ambiente de Estoque.


O código Java está em `services/inventory/src/main/java/br/com/delivery/inventory`.
Comece por `domain/StockRules.java` e `application/usecase/AddStockUseCase.java`.
O [guia do serviço](services/inventory/README.md) explica as pastas e as classes.
Produtos permanece em NestJS. O serviço Java mantém os bancos e dados da
versão anterior; não é necessário excluir volumes para migrar.
