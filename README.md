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
~~~

O gateway local ficará disponível em http://localhost:8080.

As rotas externas de Produtos ficam sob /api/v1/products. A rota interna
/internal/v1/products/:id é acessível apenas dentro da rede Docker com
X-Internal-Token; o Nginx retorna 404 para /internal/.

O ambiente inicial usa AUTH_ENABLED=false apenas para desenvolvimento local.
Em qualquer ambiente real, configure AUTH_ENABLED=true e um JWT_SECRET seguro.
O token de serviço interno deve ser diferente do segredo JWT.

Para gerar um JWT de desenvolvimento:

~~~bash
JWT_SECRET=change-me-in-development node scripts/generate-dev-jwt.mjs <usuario-id> dev@example.com
~~~

Comandos de operação:

~~~bash
npm run infra:up
npm run infra:down
docker compose -f infra/docker/docker-compose.yml ps
docker compose -f infra/docker/docker-compose.yml logs -f products-service
~~~

A implementação inicial contém somente o microsserviço de Produtos, seus dois
bancos CQRS, RabbitMQ e o gateway Nginx. Auth, Estoque e Pedidos serão
adicionados em etapas posteriores.
