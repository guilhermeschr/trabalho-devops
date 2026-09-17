# Trabalho DevOps

Sistema de delivery com microsserviços. A implementação inicial está sendo feita pelo microsserviço de Produtos.

## Requisitos locais

- Node.js 24 ou superior
- npm 11 ou superior
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

O gateway local ficará disponível em http://localhost:8080.
O Swagger local ficará disponível em http://localhost:8080/docs e o documento
OpenAPI em http://localhost:8080/docs-json.

As rotas externas de Produtos são:

- `GET /api/v1/products`
- `POST /api/v1/products`
- `PUT /api/v1/products/:id`

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

A implementação inicial contém somente o microsserviço de Produtos, seus dois
bancos CQRS, RabbitMQ e o gateway Nginx. Auth, Estoque e Pedidos serão
adicionados em etapas posteriores.
