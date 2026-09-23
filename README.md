# Trabalho DevOps

Sistema de delivery com microsserviços. Auth, Produtos e Estoque estão implementados.

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

As rotas públicas de Produtos e Estoque sempre exigem `Authorization: Bearer <jwt>`,
em qualquer ambiente. Obtenha o token pelo login do Auth ou pelo gerador abaixo.
Em qualquer ambiente real, configure um JWT_SECRET seguro.
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

A implementação contém Auth, com banco próprio, e Produtos e Estoque, cada um
com dois bancos CQRS, Pedidos com "orders-db", RabbitMQ e o gateway Nginx.

## Auth — cadastro e login

Rotas públicas (sem JWT):

- `POST /api/v1/auth/register`: `{ "name", "email", "password" }`. O e-mail é
  normalizado para minúsculas e a senha, com 8 a 72 caracteres, é gravada
  somente como hash bcrypt. Retorna 201; e-mail duplicado retorna 409.
- `POST /api/v1/auth/login`: `{ "email", "password" }`. Retorna 200 com
  `accessToken`, `tokenType`, `expiresIn` e `user`; credenciais inválidas
  retornam 401.

~~~bash
curl -s http://localhost:8080/api/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Maria Silva","email":"maria@example.com","password":"SenhaSegura123"}'
TOKEN=$(curl -s http://localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"maria@example.com","password":"SenhaSegura123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/inventory/<product-id>
~~~

O JWT é assinado com `JWT_SECRET` (HS256, claims `sub`, `email`, `iat` e `exp`)
e validado localmente pelos demais serviços. A validade vem de
`JWT_EXPIRES_IN`, em segundos.

Swagger de Auth: http://localhost:8080/auth/docs.

~~~bash
npm run test:auth
npm run build:auth
npm run verify:swagger:auth
~~~

## Pedidos — criação, consulta e conclusão

Todas as rotas exigem JWT; o `userId` vem do claim `sub`.

- `POST /api/v1/orders`: `{ "productId": "<uuid>", "quantity": 2 }`. Consulta
  o produto em Produtos, debita o estoque em Estoque (idempotente por
  `orderId`) e grava o pedido com o preço consultado. Retorna 201 com status
  `CREATED`; produto inexistente 404, produto inativo ou estoque insuficiente
  409 e Produtos/Estoque indisponível 503.
- `GET /api/v1/orders/:id`: somente o proprietário (outro usuário recebe 403).
- `POST /api/v1/orders/:id/complete`: `CREATED → COMPLETED`; repetir retorna
  200 sem nova alteração.

~~~bash
ORDER=$(curl -s http://localhost:8080/api/v1/orders -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"productId":"<product-id>","quantity":2}')
ORDER_ID=$(echo "$ORDER" | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/orders/$ORDER_ID
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/orders/$ORDER_ID/complete
~~~

O timeout das chamadas a Produtos e Estoque é `ORDERS_HTTP_TIMEOUT_MS`
(padrão 3000). Swagger de Pedidos: http://localhost:8080/orders/docs.

~~~bash
npm run test:orders
npm run build:orders
npm run verify:swagger:orders
~~~


## Estoque — Java e Spring Boot

- `POST /api/v1/inventory`: `{ "productId": "<uuid>", "quantity": 20 }`.
- `GET /api/v1/inventory/:productId`: consulta o saldo projetado.
- `POST /internal/v1/inventory/debit`: `{ "orderId": "<uuid>", "productId": "<uuid>", "quantity": 2 }`, somente na rede interna com `X-Internal-Token`.

Rotas públicas sempre exigem `Authorization: Bearer <jwt>`. Use o token do
login do Auth ou gere um JWT com o script descrito acima.
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

## Fluxo completo entre os serviços

Com a infraestrutura em execução, o roteiro da seção 12.3 da especificação
percorre cadastro, login, criação de produto, adição de estoque, consulta das
projeções de Produto e Estoque, criação, consulta e conclusão do pedido e a
repetição da conclusão (idempotência). Todas as chamadas passam pelo gateway
com o JWT real emitido pelo login, e as projeções são aguardadas com polling.

~~~bash
npm run infra:up
npm run verify:flow
~~~

O comando executa o container `flow-check` (perfil `tools`). O mesmo roteiro
pode ser executado do host com `node scripts/verify-flow.mjs`, usando
`GATEWAY_URL` (padrão `http://localhost:8080`). Cada execução cria um usuário,
um produto e um pedido de teste.
