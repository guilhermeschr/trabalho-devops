# Especificação do Sistema de Delivery com Microsserviços

**Status:** especificação de referência para implementação
**Versão:** 2.6
**Última atualização:** 2026-09-23
**Idioma:** português
**Objetivo:** orientar a construção, execução e validação de um sistema simples de delivery com foco em DevOps.

## Histórico de alterações

| Versão | Data | Alteração |
|---|---|---|
| 2.6 | 2026-09-23 | Nginx repassa `X-Request-Id` válido do cliente e gera um quando ausente ou inválido, descarta `X-Internal-Token` externo, aceita somente `PUT` em `/api/v1/products/:id` e retorna erros JSON (404 `ROUTE_NOT_FOUND`, 405 `METHOD_NOT_ALLOWED`, 503 `SERVICE_UNAVAILABLE`); `verify:flow` valida esse comportamento |
| 2.5 | 2026-09-23 | Adicionado o roteiro de validação ponta a ponta `npm run verify:flow` (container `flow-check`, perfil `tools`), executado pelo gateway com o JWT real do login e polling das projeções |
| 2.4 | 2026-09-23 | Implementado Pedidos em NestJS com criação, consulta e conclusão, clientes REST de Produtos e Estoque com timeout, banco `orders-db`, Swagger em `/orders/docs`, validação `verify:swagger:orders` e cobertura mínima; definidos `PRODUCT_INACTIVE` (409), o mapeamento de erros das dependências e a retentativa de gravação após o débito |
| 2.3 | 2026-09-23 | Removido o bypass temporário `AUTH_ENABLED` de Produtos (antiga seção 9.1); JWT obrigatório em todas as rotas públicas, em qualquer ambiente |
| 2.2 | 2026-09-23 | Implementado Auth em NestJS com cadastro, login JWT, banco `auth-db`, Swagger em `/auth/docs`, validação `verify:swagger:auth` e cobertura mínima |
| 2.1 | 2026-09-23 | Definida a stack NestJS/TypeORM/Jest para Auth e Pedidos, com injeção de dependências por tokens; variáveis de ambiente alinhadas ao padrão real por serviço |
| 2.0 | 2026-09-18 | Migrado somente Estoque para Java 21 e Spring Boot; Spring JDBC, Flyway, JUnit/JaCoCo; preservados contratos HTTP, eventos e dados existentes |
| 1.9 | 2026-09-18 | Implementado Estoque com CQRS, débito idempotente concorrente, projeção versionada, Outbox, Swagger e infraestrutura; normalizado nome Compose para delivery |
| 1.8 | 2026-09-17 | Adicionados os filtros opcionais por ID exato e nome parcial na consulta de produtos, com contrato Swagger e validação automatizada |
| 1.7 | 2026-09-17 | Tornada obrigatória a recriação do container e a validação HTTP da interface `/docs` e do documento `/docs-json` |
| 1.6 | 2026-09-17 | Adicionada a consulta de todos os produtos e removida a consulta pública de produto por ID, mantendo a edição e a consulta interna |
| 1.5 | 2026-09-17 | Corrigidos o carregamento do `.env` da raiz nos comandos Docker Compose e o serviço usado no comando de logs |
| 1.4 | 2026-09-17 | Adicionada documentação Swagger/OpenAPI de todas as rotas, validação automatizada do contrato e controle de habilitação por ambiente |
| 1.3 | 2026-09-17 | Ajustada a rede Docker para permitir a publicação do gateway Nginx no host, mantendo bancos e RabbitMQ sem portas externas |
| 1.2 | 2026-09-17 | Corrigida a dependência de runtime do adaptador HTTP Express exigido pelo NestJS no container de Produtos |
| 1.1 | 2026-09-17 | Início da implementação do microsserviço de Produtos, com CQRS, Outbox, RabbitMQ, Docker Compose e bypass temporário de JWT somente no ambiente local |
| 1.0 | 2026-09-16 | Criação da especificação inicial do sistema de delivery |

## 1. Objetivo e escopo

O sistema deverá permitir o cadastro de usuários, o cadastro e consulta de produtos, o controle de estoque e a criação, consulta e conclusão de pedidos.

O trabalho deverá demonstrar:

- Separação de responsabilidades entre microsserviços.
- Comunicação REST síncrona entre serviços.
- Gateway Nginx para as requisições externas.
- CQRS nos serviços de Produtos e Estoque.
- Bancos de escrita e leitura separados para Produtos e Estoque.
- RabbitMQ para atualização dos modelos de consulta.
- Injeção de dependências com NestJS em Produtos, Auth e Pedidos e com Spring em Estoque.
- Testes unitários com cobertura mínima de 50% em cada microsserviço.
- Execução local reproduzível com Docker Compose.

### 1.1 Fora do escopo

Não fazem parte desta versão:

- Pagamento.
- Cancelamento de pedido.
- Rastreamento ou cálculo de entrega.
- Múltiplos produtos no mesmo pedido.
- Frontend.
- Deploy em nuvem.
- Pipeline GitHub Actions.
- Autorização baseada em múltiplos perfis de usuário.

## 2. Arquitetura geral

### 2.1 Stack obrigatória

| Categoria | Tecnologia |
|---|---|
| Linguagem | TypeScript (Produtos, Auth e Pedidos); Java 21 (Estoque) |
| Runtime | Node.js (Produtos, Auth e Pedidos); JVM (Estoque) |
| Framework | NestJS (Produtos, Auth e Pedidos); Spring Boot 3.5.16 (Estoque) |
| Persistência | PostgreSQL |
| Persistência e migrações | TypeORM com migrações executadas na inicialização (Produtos, Auth e Pedidos); Spring JDBC e Flyway (Estoque) |
| Hash de senha | bcryptjs, implementação bcrypt em JavaScript puro, sem compilação nativa (Auth) |
| Cliente REST | `fetch` nativo do Node.js com `AbortSignal.timeout` (Pedidos) |
| Mensageria | RabbitMQ |
| Gateway | Nginx |
| Empacotamento | Docker e Docker Compose |
| Testes | Jest e Supertest (Produtos, Auth e Pedidos); JUnit 5, Mockito, MockMvc, Testcontainers e JaCoCo (Estoque) |
| Documentação de API | Swagger/OpenAPI |

Cada serviço TypeScript é um workspace npm próprio na raiz do repositório
(`services/products`, `services/auth` e `services/orders`), com `package.json`,
configuração Jest e Dockerfile independentes. Estoque é construído com Maven e
não participa dos workspaces npm.

### 2.2 Componentes

| Componente | Responsabilidade |
|---|---|
| "nginx-gateway" | Receber chamadas externas e encaminhá-las ao microsserviço correto |
| "auth-service" | Cadastrar usuários, autenticar credenciais e emitir JWT |
| "products-service" | Criar, editar e consultar produtos |
| "inventory-service" | Adicionar, consultar e debitar estoque |
| "orders-service" | Criar, consultar e concluir pedidos |
| "rabbitmq" | Transportar eventos dos modelos de escrita para os modelos de leitura |
| "auth-db" | Persistir usuários |
| "orders-db" | Persistir pedidos |
| "products-write-db" | Persistir comandos de Produtos |
| "products-read-db" | Persistir a projeção de consulta de Produtos |
| "inventory-write-db" | Persistir comandos de Estoque |
| "inventory-read-db" | Persistir a projeção de consulta de Estoque |

Cada microsserviço deverá ser dono dos próprios dados. Nenhum serviço poderá acessar diretamente o banco de outro serviço.

### 2.3 Fluxo de comunicação

~~~mermaid
flowchart LR
    Client[Cliente] --> Nginx[Nginx Gateway]
    Nginx --> Auth[Auth Service]
    Nginx --> Products[Products Service]
    Nginx --> Inventory[Inventory Service]
    Nginx --> Orders[Orders Service]

    Orders -- REST síncrono --> Products
    Orders -- REST síncrono --> Inventory

    ProductsWrite[(Products Write DB)] --> ProductOutbox[Outbox Products]
    ProductOutbox --> Rabbit[RabbitMQ]
    Rabbit --> ProductsRead[(Products Read DB)]

    InventoryWrite[(Inventory Write DB)] --> InventoryOutbox[Outbox Inventory]
    InventoryOutbox --> Rabbit
    Rabbit --> InventoryRead[(Inventory Read DB)]

    Auth --> AuthDB[(Auth DB)]
    Orders --> OrdersDB[(Orders DB)]
~~~

### 2.4 Regras de rede

- Somente o Nginx deverá publicar portas HTTP para o cliente.
- Bancos, RabbitMQ e endpoints internos não deverão ser publicados para acesso externo.
- Os serviços deverão se comunicar usando os nomes dos containers na rede Docker.
- Os endpoints internos deverão exigir o cabeçalho "X-Internal-Token".
- O Nginx não deverá encaminhar rotas com prefixo "/internal/".

## 3. Rotas externas

As rotas externas são as únicas que deverão ser expostas pelo Nginx.

Todas as rotas, exceto cadastro e login, deverão exigir:

~~~http
Authorization: Bearer <jwt>
Content-Type: application/json
~~~

| Método | Rota | Serviço | Autenticação | Descrição |
|---|---|---|---|---|
| POST | /api/v1/auth/register | Auth | Pública | Cadastrar usuário |
| POST | /api/v1/auth/login | Auth | Pública | Autenticar usuário e emitir JWT |
| POST | /api/v1/products | Produtos | JWT | Criar produto |
| PUT | /api/v1/products/:id | Produtos | JWT | Editar produto |
| GET | /api/v1/products | Produtos | JWT | Consultar todos os produtos |
| POST | /api/v1/inventory | Estoque | JWT | Criar ou adicionar estoque |
| GET | /api/v1/inventory/:productId | Estoque | JWT | Consultar estoque |
| POST | /api/v1/orders | Pedidos | JWT | Criar pedido |
| GET | /api/v1/orders/:id | Pedidos | JWT | Consultar pedido |
| POST | /api/v1/orders/:id/complete | Pedidos | JWT | Concluir pedido |

### 3.1 Cadastro de usuário

#### Requisição

POST /api/v1/auth/register

~~~json
{
  "name": "Maria Silva",
  "email": "maria@example.com",
  "password": "SenhaSegura123"
}
~~~

#### Resposta 201 Created

~~~json
{
  "id": "9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01",
  "name": "Maria Silva",
  "email": "maria@example.com",
  "createdAt": "2026-09-16T15:00:00.000Z"
}
~~~

Regras:

- O e-mail deverá ser único e normalizado para letras minúsculas.
- A senha nunca poderá ser retornada.
- A senha deverá ser armazenada com hash usando bcrypt ou Argon2.
- Senha com formato inválido deverá retornar 400. A senha deverá ser texto com
  8 a 72 caracteres; o limite superior corresponde ao máximo processado pelo
  bcrypt.
- Nome deverá ter de 1 a 120 caracteres após remover espaços nas extremidades.
- Campos desconhecidos no corpo deverão retornar 400.
- E-mail já cadastrado deverá retornar 409 com código `EMAIL_ALREADY_REGISTERED`.

### 3.2 Login

#### Requisição

POST /api/v1/auth/login

~~~json
{
  "email": "maria@example.com",
  "password": "SenhaSegura123"
}
~~~

#### Resposta 200 OK

~~~json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01",
    "name": "Maria Silva",
    "email": "maria@example.com"
  }
}
~~~

Credenciais inválidas deverão retornar 401 com código `INVALID_CREDENTIALS`,
sem diferenciar e-mail inexistente de senha incorreta. O e-mail do login é
normalizado para minúsculas antes da consulta.

### 3.3 Criar produto

#### Requisição

POST /api/v1/products

~~~json
{
  "name": "Hambúrguer artesanal",
  "description": "Hambúrguer com queijo e molho especial",
  "price": 29.90,
  "active": true
}
~~~

#### Resposta 201 Created

~~~json
{
  "id": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "name": "Hambúrguer artesanal",
  "description": "Hambúrguer com queijo e molho especial",
  "price": 29.90,
  "active": true,
  "createdAt": "2026-09-16T15:05:00.000Z",
  "updatedAt": "2026-09-16T15:05:00.000Z"
}
~~~

O comando deverá ser gravado em "products-write-db" e gerar o evento "product.created".

### 3.4 Editar produto

#### Requisição

PUT /api/v1/products/:id

~~~json
{
  "name": "Hambúrguer artesanal especial",
  "description": "Hambúrguer com queijo, bacon e molho especial",
  "price": 34.90,
  "active": true
}
~~~

#### Resposta 200 OK

A resposta deverá possuir o mesmo formato da criação. O comando deverá gerar o evento "product.updated".

Regras:

- PUT deverá receber todos os campos editáveis.
- Produto inexistente deverá retornar 404.
- O preço deverá ser positivo e possuir no máximo duas casas decimais.

### 3.5 Consultar todos os produtos

#### Requisição

GET /api/v1/products

#### Resposta 200 OK

~~~json
[
  {
    "id": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
    "name": "Hambúrguer artesanal especial",
    "description": "Hambúrguer com queijo, bacon e molho especial",
    "price": 34.90,
    "active": true,
    "createdAt": "2026-09-16T15:05:00.000Z",
    "updatedAt": "2026-09-16T15:10:00.000Z"
  }
]
~~~

Essa rota deverá consultar exclusivamente "products-read-db" e retornar
produtos ativos e inativos. Quando não houver produtos projetados, deverá
retornar um array vazio. Não haverá paginação nesta versão, mas a consulta
aceitará os filtros opcionais abaixo:

| Parâmetro | Obrigatório | Comportamento |
|---|---|---|
| `id` | Não | UUID exato do produto |
| `name` | Não | Parte do nome, sem diferenciar letras maiúsculas e minúsculas |

Exemplos:

~~~http
GET /api/v1/products?id=4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20
GET /api/v1/products?name=pizza
GET /api/v1/products?id=4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20&name=pizza
~~~

Quando os dois filtros forem informados, eles deverão ser combinados com
`AND`. O filtro `name` deverá remover espaços nas extremidades e utilizar
busca parcial. Um `id` que não seja UUID válido, um `name` vazio ou um `name`
com mais de 120 caracteres deverá retornar 400. Como o modelo de leitura é
eventualmente consistente, uma criação ou edição poderá levar alguns instantes
para aparecer nessa rota.

### 3.6 Adicionar estoque

#### Requisição

POST /api/v1/inventory

~~~json
{
  "productId": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "quantity": 20
}
~~~

#### Resposta 200 OK

~~~json
{
  "productId": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "availableQuantity": 20,
  "updatedAt": "2026-09-16T15:15:00.000Z"
}
~~~

O comando deverá ser gravado em "inventory-write-db" e gerar o evento "inventory.stock_added".

### 3.7 Consultar estoque

#### Requisição

GET /api/v1/inventory/:productId

#### Resposta 200 OK

~~~json
{
  "productId": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "availableQuantity": 20,
  "updatedAt": "2026-09-16T15:15:00.000Z"
}
~~~

Essa rota deverá consultar exclusivamente "inventory-read-db".

### 3.8 Criar pedido

#### Requisição

POST /api/v1/orders

~~~json
{
  "productId": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "quantity": 2
}
~~~

#### Resposta 201 Created

~~~json
{
  "id": "d3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc",
  "userId": "9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01",
  "productId": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "quantity": 2,
  "unitPrice": 34.90,
  "total": 69.80,
  "status": "CREATED",
  "createdAt": "2026-09-16T15:20:00.000Z",
  "updatedAt": "2026-09-16T15:20:00.000Z"
}
~~~

O "userId" deverá ser obtido do campo "sub" do JWT, nunca do corpo da requisição.

Regras:

- `productId` deverá ser UUID e `quantity` um inteiro entre 1 e 2147483647.
  Campos desconhecidos (inclusive `userId`) retornam 400 (`VALIDATION_ERROR`).
- `unitPrice` é o preço retornado por Produtos no momento da criação e
  `total = unitPrice × quantity`, calculado em centavos inteiros.

| Situação | HTTP | Código |
|---|---|---|
| JWT ausente, inválido ou sem `sub` | 401 | `UNAUTHORIZED` |
| Corpo inválido | 400 | `VALIDATION_ERROR` |
| Produto inexistente | 404 | `PRODUCT_NOT_FOUND` |
| Produto inativo | 409 | `PRODUCT_INACTIVE` |
| Estoque insuficiente | 409 | `INSUFFICIENT_STOCK` |
| Produtos ou Estoque indisponível ou sem resposta no timeout | 503 | `DEPENDENCY_UNAVAILABLE` |
| Resposta inesperada de uma dependência ou falha ao gravar | 500 | `INTERNAL_SERVER_ERROR` |

### 3.9 Consultar pedido

#### Requisição

GET /api/v1/orders/:id

#### Resposta 200 OK

~~~json
{
  "id": "d3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc",
  "userId": "9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01",
  "productId": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "quantity": 2,
  "unitPrice": 34.90,
  "total": 69.80,
  "status": "CREATED",
  "createdAt": "2026-09-16T15:20:00.000Z",
  "updatedAt": "2026-09-16T15:20:00.000Z"
}
~~~

O usuário somente poderá consultar os próprios pedidos. Pedido inexistente deverá retornar 404 (`ORDER_NOT_FOUND`) e pedido de outro usuário deverá retornar 403 (`ORDER_FORBIDDEN`). Um `:id` que não seja UUID retorna 400. A existência é verificada antes da propriedade.

### 3.10 Concluir pedido

#### Requisição

POST /api/v1/orders/:id/complete

A requisição não terá corpo.

#### Resposta 200 OK

~~~json
{
  "id": "d3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc",
  "userId": "9f5c2e9c-7ab3-4b48-9e74-2bf6c58b4e01",
  "productId": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "quantity": 2,
  "unitPrice": 34.90,
  "total": 69.80,
  "status": "COMPLETED",
  "createdAt": "2026-09-16T15:20:00.000Z",
  "updatedAt": "2026-09-16T15:25:00.000Z"
}
~~~

Regras:

- Somente o proprietário poderá concluir o pedido.
- A transição válida será "CREATED -> COMPLETED".
- Pedido inexistente deverá retornar 404 (`ORDER_NOT_FOUND`).
- Usuário diferente do proprietário deverá receber 403 (`ORDER_FORBIDDEN`).
- Pedido em estado inválido deverá retornar 409 (`INVALID_ORDER_STATUS`).
- Pedido já concluído deverá retornar 200 com status "COMPLETED", sem duplicar alterações.
- A gravação usa atualização condicional (`status = 'CREATED'`); conclusões
  simultâneas alteram o pedido uma única vez e todas retornam 200.

## 4. Rotas internas

As rotas internas não deverão ser configuradas no Nginx e não poderão ser chamadas por clientes externos.

### 4.1 Consultar produto internamente

GET /internal/v1/products/:id

**Origem:** "orders-service"
**Destino:** "products-service"
**Banco consultado:** "products-read-db"

Headers obrigatórios:

~~~http
X-Internal-Token: <token-compartilhado>
~~~

Resposta:

~~~json
{
  "id": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "name": "Hambúrguer artesanal especial",
  "price": 34.90,
  "active": true
}
~~~

### 4.2 Debitar estoque internamente

POST /internal/v1/inventory/debit

**Origem:** "orders-service"
**Destino:** "inventory-service"
**Banco alterado:** "inventory-write-db"

Requisição:

~~~json
{
  "orderId": "d3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc",
  "productId": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "quantity": 2
}
~~~

Resposta 200 OK:

~~~json
{
  "orderId": "d3be31b7-9833-4e4f-9ae2-2fd3b1dba5bc",
  "productId": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "debitedQuantity": 2,
  "remainingQuantity": 18
}
~~~

O débito deverá ser idempotente por "orderId". Repetições da mesma solicitação não poderão debitar o estoque duas vezes.

### 4.3 Health check

Cada serviço deverá possuir:

GET /health

O endpoint deverá ser usado pelo Docker Compose e não deverá ser exposto pelo Nginx como rota de negócio.

Resposta esperada:

~~~json
{
  "status": "ok",
  "service": "orders-service",
  "timestamp": "2026-09-16T15:30:00.000Z"
}
~~~

## 5. Formato de erros

Todos os serviços deverão retornar erros neste formato:

~~~json
{
  "status": 409,
  "code": "INSUFFICIENT_STOCK",
  "message": "Quantidade solicitada maior que o estoque disponível",
  "path": "/internal/v1/inventory/debit",
  "traceId": "req-8f82c4",
  "timestamp": "2026-09-16T15:35:00.000Z"
}
~~~

Códigos HTTP obrigatórios:

| Código | Uso |
|---|---|
| 200 | Consulta, edição, débito e conclusão |
| 201 | Cadastro e criação |
| 400 | Validação ou formato inválido |
| 401 | JWT ausente, inválido ou credenciais inválidas |
| 403 | Usuário sem permissão |
| 404 | Recurso não encontrado |
| 409 | Conflito, estoque insuficiente ou transição inválida |
| 503 | Dependência indisponível |

## 6. Fluxos de negócio

### 6.1 Criação de pedido

1. O cliente chama POST /api/v1/orders pelo Nginx.
2. O "orders-service" valida o JWT.
3. O serviço extrai "userId" do claim "sub".
4. O serviço chama GET /internal/v1/products/:id.
5. O "products-service" consulta "products-read-db".
6. O serviço valida se o produto existe e está ativo.
7. O serviço chama POST /internal/v1/inventory/debit.
8. O "inventory-service" verifica e atualiza "inventory-write-db".
9. O débito gera "inventory.stock_debited" na Outbox.
10. O "orders-service" grava o pedido com o preço consultado.
11. A API retorna o pedido com status "CREATED".

O fluxo não deverá acessar bancos de outros serviços diretamente.

Produto inativo interrompe o fluxo no passo 6 com 409 `PRODUCT_INACTIVE`, sem
debitar estoque. O `orderId` é gerado pelo "orders-service" antes do passo 7 e
enviado no débito, que é idempotente por `orderId` no Estoque.

Decisão de consistência (débito → gravação): o débito acontece antes da
gravação do pedido. Se a gravação falhar, o serviço repete o INSERT uma vez com
o mesmo `orderId`. Persistindo a falha, registra em log `orderId` e `traceId`
para reconciliação manual e retorna 500. Nesta versão não há compensação
automática: Estoque não possui rota de estorno e uma nova requisição do cliente
gera outro `orderId`.

### 6.2 Conclusão de pedido

1. O cliente chama POST /api/v1/orders/:id/complete.
2. O Nginx encaminha para "orders-service".
3. O serviço valida o JWT.
4. O serviço verifica se o pedido pertence ao usuário.
5. O serviço valida o status atual.
6. O serviço atualiza o status para "COMPLETED".
7. A API retorna o pedido atualizado.

### 6.3 Falhas entre serviços

- Timeout ou indisponibilidade de Produtos ou Estoque deverá retornar 503.
- O cliente REST deverá utilizar timeout configurável.
- O erro deverá registrar "traceId" e o serviço de origem.
- Nenhum erro interno deverá expor stack trace ou credenciais.
- Em Pedidos, timeout (`ORDERS_HTTP_TIMEOUT_MS`), falha de conexão e respostas
  5xx da dependência retornam 503 `DEPENDENCY_UNAVAILABLE`, com a mensagem
  "Serviço de Produtos indisponível" ou "Serviço de Estoque indisponível".
- Respostas que Pedidos não trata (por exemplo, 403 por token interno incorreto
  ou 409 `IDEMPOTENCY_CONFLICT`) indicam erro de configuração e retornam 500
  genérico, registrado em log com serviço, status e `traceId`.
- Pedidos repassa `X-Request-Id` às chamadas internas; quando ausente, gera um
  UUID e o devolve no cabeçalho da resposta.

## 7. CQRS e RabbitMQ

### 7.1 Banco de escrita

O banco de escrita deverá receber comandos e manter a fonte oficial dos dados.

Produtos deverá possuir, no mínimo:

- "products"
- "outbox_events"

Estoque deverá possuir, no mínimo:

- "stock"
- "stock_movements"
- "outbox_events"

### 7.2 Banco de leitura

O banco de leitura deverá conter apenas projeções destinadas às consultas.

Produtos deverá possuir uma projeção equivalente a:

- "products_projection"

Estoque deverá possuir uma projeção equivalente a:

- "stock_projection"

As rotas GET não poderão consultar os bancos de escrita.

### 7.3 Eventos

Eventos obrigatórios:

- "product.created"
- "product.updated"
- "inventory.stock_added"
- "inventory.stock_debited"

Envelope padrão:

~~~json
{
  "eventId": "be4ec7c3-b9e4-4f7c-8b47-3bc8c0c0104d",
  "eventType": "product.created",
  "aggregateId": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "occurredAt": "2026-09-16T15:40:00.000Z",
  "version": 1,
  "payload": {
    "id": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
    "name": "Hambúrguer artesanal",
    "price": 29.90,
    "active": true
  }
}
~~~

### 7.4 RabbitMQ

- Usar exchange durável do tipo "topic": "delivery.events".
- Usar filas duráveis:
  - "products.read.projector"
  - "inventory.read.projector"
- Confirmar a publicação dos eventos.
- Reprocessar mensagens não confirmadas.
- Confirmar a mensagem somente após atualizar o banco de leitura.
- Registrar "eventId" processado para garantir idempotência.

### 7.5 Outbox transacional

Cada comando de Produtos e Estoque deverá:

1. Abrir uma transação no banco de escrita.
2. Alterar o dado principal.
3. Gravar o evento na tabela "outbox_events".
4. Confirmar a transação.
5. Publicar o evento por um worker.
6. Marcar o evento como publicado após confirmação do RabbitMQ.

Se RabbitMQ estiver indisponível, o evento deverá permanecer pendente para nova tentativa.

## 8. Injeção de dependências e organização de código

Cada microsserviço deverá seguir uma organização semelhante:

~~~text
src/
  modules/
    <modulo>/
      domain/
      application/
      infrastructure/
      presentation/
  shared/
    config/
    http/
    messaging/
    auth/
~~~

Responsabilidades:

- "presentation": controllers, DTOs e filtros HTTP.
- "application": casos de uso e portas/interfaces.
- "domain": entidades e regras de negócio.
- "infrastructure": TypeORM ou Spring JDBC, RabbitMQ, clientes REST e adaptadores.

Regras obrigatórias:

- Controllers dependem somente de casos de uso.
- Casos de uso dependem de interfaces, não de implementações concretas.
- Em Produtos, Auth e Pedidos, portas são declaradas com tokens `Symbol` e registradas no módulo NestJS com providers `useClass`; em Estoque, implementações das interfaces são beans Spring injetados pelo construtor.
- Em Auth, o repositório de usuários (`USER_REPOSITORY`), o gerador de hash de senha (`PASSWORD_HASHER`) e o emissor de JWT (`TOKEN_ISSUER`) são portas injetadas nos casos de uso.
- Em Pedidos, o repositório de pedidos (`ORDER_REPOSITORY`) e os clientes REST de Produtos (`PRODUCTS_CLIENT`) e Estoque (`INVENTORY_CLIENT`) são portas injetadas; URLs, token interno e timeout dos clientes vêm do ConfigService.
- Bancos de leitura e escrita devem possuir conexões nomeadas; Auth e Pedidos usam uma conexão nomeada para o próprio banco.
- Clientes REST devem ser providers injetáveis.
- Publicadores e consumidores RabbitMQ devem ser providers injetáveis.
- Configurações são obtidas pelo ConfigService (NestJS) ou pelo Environment/propriedades do Spring, sempre a partir do ambiente.
- Não usar instanciação manual de dependências dentro de controllers ou casos de uso.
- Não usar singletons globais para repositórios, clientes HTTP ou conexões.

Exemplo de contrato:

~~~typescript
export const PRODUCT_WRITE_REPOSITORY = Symbol('PRODUCT_WRITE_REPOSITORY');

export interface ProductWriteRepository {
  create(product: Product): Promise<Product>;
  update(id: string, product: Product): Promise<Product>;
}
~~~

O caso de uso deverá receber essa interface por injeção, permitindo substituí-la por mock nos testes.

## 9. Autenticação

- Auth deverá emitir JWT contendo pelo menos "sub", "email" e "iat".
- Os microsserviços deverão validar o JWT localmente.
- A chave JWT deverá vir de variável de ambiente.
- Senhas deverão ser armazenadas somente como hash.
- Rotas internas deverão sempre exigir "X-Internal-Token".
- O token interno deverá ser diferente do segredo utilizado para JWT.
- Tokens, senhas e secrets nunca poderão aparecer nos logs.
- Não há bypass de JWT em nenhum ambiente: rotas externas protegidas sempre
  exigem um JWT válido assinado com "JWT_SECRET".

## 10. Docker Compose e configuração

Na implementação atual, o arquivo
`infra/docker/docker-compose.yml` contém:

- "nginx-gateway"
- "auth-service"
- "auth-db"
- "products-service"
- "products-write-db"
- "products-read-db"
- "inventory-service"
- "inventory-write-db"
- "inventory-read-db"
- "orders-service"
- "orders-db"
- "rabbitmq"

Esse é o conjunto completo de containers do sistema. O container auxiliar
"inventory-check" só é iniciado pelo perfil `tools`.

Requisitos:

- Todos os serviços deverão estar na mesma rede Docker privada.
- Bancos deverão possuir volumes persistentes.
- RabbitMQ deverá possuir volume persistente.
- Health checks deverão ser configurados para bancos, RabbitMQ e microsserviços.
- Os microsserviços deverão aguardar as dependências ficarem saudáveis.
- Portas de bancos e RabbitMQ não deverão ser publicadas para acesso externo.
- O gateway inicial deverá publicar somente a porta HTTP configurada para o
  Nginx, por padrão 8080.
- O serviço de Produtos deverá executar as migrações TypeORM de escrita e
  leitura antes de atender as rotas.
- O serviço de Auth deverá executar a migração TypeORM de "auth-db" antes de
  atender as rotas.
- O serviço de Pedidos deverá executar a migração TypeORM de "orders-db" antes
  de atender as rotas e aguardar "orders-db", "products-service" e
  "inventory-service" saudáveis.
- Todos os Dockerfiles que executam `npm ci` na raiz deverão copiar o
  `package.json` de todos os workspaces npm declarados.

Variáveis de ambiente por serviço. Cada microsserviço lê somente as
variáveis do próprio prefixo e as comuns de que precisa; a porta interna de
todos os containers é 3000.

| Escopo | Variáveis |
|---|---|
| Comuns | `NODE_ENV`, `SWAGGER_ENABLED`, `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN` |
| Gateway | `PRODUCTS_PUBLIC_PORT` (porta HTTP publicada pelo Nginx, padrão 8080) |
| RabbitMQ (Produtos e Estoque) | `RABBITMQ_URL`, `RABBITMQ_EXCHANGE` |
| Produtos | `PRODUCTS_PORT`, `PRODUCTS_WRITE_DB_{HOST,PORT,NAME,USER,PASSWORD}`, `PRODUCTS_READ_DB_{HOST,PORT,NAME,USER,PASSWORD}`, `RABBITMQ_PRODUCTS_QUEUE` |
| Estoque | `INVENTORY_PORT`, `INVENTORY_WRITE_DB_{HOST,PORT,NAME,USER,PASSWORD}`, `INVENTORY_READ_DB_{HOST,PORT,NAME,USER,PASSWORD}`, `RABBITMQ_INVENTORY_QUEUE` |
| Auth | `AUTH_PORT`, `AUTH_DB_{HOST,PORT,NAME,USER,PASSWORD}`, `JWT_EXPIRES_IN` |
| Pedidos | `ORDERS_PORT`, `ORDERS_DB_{HOST,PORT,NAME,USER,PASSWORD}`, `PRODUCTS_SERVICE_URL`, `INVENTORY_SERVICE_URL`, `ORDERS_HTTP_TIMEOUT_MS` |

Regras:

- `JWT_SECRET` é o mesmo em todos os serviços: Auth assina e os demais validam
  localmente.
- `JWT_EXPIRES_IN` é a validade do JWT em segundos (padrão `3600`). O sufixo
  `s` é aceito por compatibilidade (`3600s`). O valor numérico é retornado em
  `expiresIn` no login.
- `INTERNAL_SERVICE_TOKEN` deverá ser diferente de `JWT_SECRET`.
- `PRODUCTS_SERVICE_URL` e `INVENTORY_SERVICE_URL` usam os nomes dos containers
  na rede Docker (`http://products-service:3000` e
  `http://inventory-service:3000`).
- `ORDERS_HTTP_TIMEOUT_MS` é o timeout, em milissegundos, de cada chamada REST
  de Pedidos (padrão 3000). Ao ser excedido, a chamada é tratada como
  dependência indisponível (503, seção 6.3).
- Nenhum serviço chama Pedidos; por isso não existe `ORDERS_SERVICE_URL`.

As credenciais deverão ser fornecidas por ".env.example" sem valores reais.

## 11. Nginx Gateway

Na versão completa, o Nginx deverá encaminhar:

~~~text
/api/v1/auth/       -> auth-service
/api/v1/products    -> products-service
/api/v1/inventory   -> inventory-service
/api/v1/orders      -> orders-service
~~~

Na implementação atual, "/api/v1/auth/" é encaminhado para "auth-service",
"/api/v1/orders" e "/api/v1/orders/" para "orders-service" e
"/api/v1/products" deverá ser encaminhado para
"products-service" para as operações de criação e consulta. O caminho
"/api/v1/products/:id" deverá ser encaminhado somente para a operação PUT de
edição. Nenhuma rota "/internal/" deverá ser encaminhada.

O Nginx deverá:

- Preservar o método HTTP e o corpo JSON.
- Encaminhar "Authorization" e "X-Request-Id".
- Gerar "X-Request-Id" quando o cliente não enviar um.
- Não encaminhar "/internal/".
- Não publicar bancos ou RabbitMQ.
- Retornar erro controlado quando o serviço de destino estiver indisponível.

Implementação em `infra/nginx/nginx.conf`:

- `X-Request-Id` do cliente é repassado quando casa com
  `^[A-Za-z0-9._:-]{1,128}$`. Quando ausente ou fora desse formato, o gateway
  usa `$request_id` (32 caracteres hexadecimais). O valor efetivo é enviado ao
  serviço, devolvido no cabeçalho `X-Request-Id` da resposta (substituindo o
  do serviço, que é o mesmo) e registrado no log de acesso.
- `X-Internal-Token` recebido do cliente é descartado: rotas públicas não o
  utilizam e rotas internas só são chamadas dentro da rede Docker.
- `/api/v1/products/:id` aceita somente `PUT`; outros métodos retornam 405.
- Erros gerados pelo próprio Nginx seguem o formato da seção 5. Erros
  retornados pelos serviços (inclusive 503 `DEPENDENCY_UNAVAILABLE` de
  Pedidos) são repassados sem alteração, pois não há `proxy_intercept_errors`.

| Situação | HTTP | Código |
|---|---|---|
| Rota não mapeada ou prefixo `/internal/` | 404 | `ROUTE_NOT_FOUND` |
| Método diferente de `PUT` em `/api/v1/products/:id` (com `Allow: PUT`) | 405 | `METHOD_NOT_ALLOWED` |
| Serviço de destino fora do ar, recusando conexão ou sem resposta (502, 503 ou 504 do upstream) | 503 | `SERVICE_UNAVAILABLE` |

Exemplo:

~~~json
{
  "status": 503,
  "code": "SERVICE_UNAVAILABLE",
  "message": "Serviço temporariamente indisponível",
  "path": "/api/v1/orders",
  "traceId": "req-8f82c4",
  "timestamp": "2026-09-16T15:35:00Z"
}
~~~

No erro do gateway, `timestamp` é gerado pelo Nginx com precisão de segundos,
e `path` fica vazio quando o caminho contém caracteres fora de
`[A-Za-z0-9/._~:-]`. O Nginx resolve os nomes dos upstreams na inicialização;
depois de recriar um serviço, reinicie o `nginx-gateway` caso o IP do container
tenha mudado.

### 11.1 Documentação Swagger

O serviço de Produtos deverá disponibilizar, no ambiente local, os endpoints:

~~~text
/docs       -> interface Swagger UI
/docs-json  -> documento OpenAPI em JSON
~~~

O Swagger deverá ser habilitado somente quando `SWAGGER_ENABLED=true` e
`NODE_ENV` não for `production`. O Compose deverá usar `false` como padrão
seguro quando a variável não for informada.

Após alterar `.env` ou a configuração do Compose, os containers deverão ser
recriados para aplicar o valor efetivo de `SWAGGER_ENABLED`:

~~~bash
npm run infra:up
docker compose --env-file .env -f infra/docker/docker-compose.yml exec -T products-service sh -lc 'printf "SWAGGER_ENABLED=%s NODE_ENV=%s\\n" "$SWAGGER_ENABLED" "$NODE_ENV"'
curl -i http://localhost:8080/docs
curl -i http://localhost:8080/docs-json
~~~

Quando o Swagger estiver habilitado, `/docs` e `/docs-json` deverão retornar
HTTP 200. Se o serviço responder `Cannot GET`, a primeira verificação deverá
ser a configuração efetiva no container e a recriação dos serviços.

O documento deverá conter todas as rotas implementadas no serviço:

| Método | Rota | Tag |
|---|---|---|
| POST | /api/v1/products | Produtos |
| GET | /api/v1/products | Produtos |
| PUT | /api/v1/products/{id} | Produtos |
| GET | /internal/v1/products/{id} | Produtos internos |
| GET | /health | Infraestrutura |

Cada rota deverá documentar método, parâmetros, corpo, headers, autenticação,
respostas HTTP, schemas e exemplos compatíveis com o comportamento real. A
listagem pública deverá documentar os parâmetros de consulta opcionais `id` e
`name`, incluindo o formato UUID do primeiro.
As rotas internas deverão aparecer documentadas, mas continuarão bloqueadas
pelo Nginx para clientes externos.

O serviço de Auth segue as mesmas regras de habilitação. Internamente, usa
`/docs` e `/docs-json`; pelo gateway, fica em `/auth/docs`, `/auth/docs/`
(recursos da interface) e `/auth/docs-json`. O documento deverá conter
exatamente as rotas abaixo, todas públicas (sem esquema de segurança):

| Método | Rota | Tag |
|---|---|---|
| POST | /api/v1/auth/register | Autenticação |
| POST | /api/v1/auth/login | Autenticação |
| GET | /health | Infraestrutura |

O serviço de Pedidos segue as mesmas regras de habilitação. Internamente, usa
`/docs` e `/docs-json`; pelo gateway, fica em `/orders/docs`, `/orders/docs/`
(recursos da interface) e `/orders/docs-json`. O documento deverá conter
exatamente as rotas abaixo; as de Pedidos exigem o esquema Bearer `jwt`:

| Método | Rota | Tag |
|---|---|---|
| POST | /api/v1/orders | Pedidos |
| GET | /api/v1/orders/{id} | Pedidos |
| POST | /api/v1/orders/{id}/complete | Pedidos |
| GET | /health | Infraestrutura |

## 12. Testes

Cada microsserviço deverá possuir testes unitários independentes.

### 12.1 Meta de cobertura

Em Produtos, Auth e Pedidos, a configuração do Jest de cada serviço deverá impedir cobertura inferior a 50%:

~~~typescript
coverageThreshold: {
  global: {
    branches: 50,
    functions: 50,
    lines: 50,
    statements: 50
  }
}
~~~

Em Estoque, `mvn verify` executa JUnit/Mockito e testes de integração com PostgreSQL real via Testcontainers. JaCoCo exige pelo menos 50% em BRANCH, METHOD, LINE e INSTRUCTION; a última mede instruções de bytecode, não statements da linguagem. O build falha quando o limite não é atendido ou quando Docker não está disponível para os testes de integração.

### 12.2 Casos obrigatórios

#### Auth

- Cadastro válido.
- Senha inválida.
- E-mail duplicado.
- Login válido.
- Login com credenciais inválidas.
- Hash de senha nunca retornado.
- Geração e validação de JWT.

#### Produtos

- Criar produto.
- Editar produto.
- Consultar produto.
- Produto inexistente.
- Dados inválidos.
- Gravação da Outbox.
- Publicação de "product.created".
- Publicação de "product.updated".

#### Estoque

- Criar estoque.
- Adicionar quantidade.
- Consultar estoque.
- Debitar estoque.
- Estoque insuficiente.
- Débito repetido com o mesmo "orderId".
- Gravação da Outbox.
- Publicação dos eventos de estoque.

#### Pedidos

- Criar pedido com JWT válido.
- Rejeitar pedido sem JWT.
- Produto inexistente.
- Produto inativo.
- Falha no cliente REST de Produtos.
- Falha no cliente REST de Estoque.
- Gravar preço consultado no pedido.
- Consultar pedido próprio.
- Impedir consulta de pedido de outro usuário.
- Concluir pedido próprio.
- Impedir conclusão por outro usuário.
- Pedido inexistente.
- Conclusão repetida idempotente.
- Transição de status inválida.

### 12.3 Testes de comunicação

Além dos testes unitários, deverá existir um roteiro de validação com Docker Compose que execute:

1. Cadastro.
2. Login.
3. Criação de produto.
4. Adição de estoque.
5. Consulta da projeção de Produto.
6. Consulta da projeção de Estoque.
7. Criação de pedido.
8. Consulta do pedido.
9. Conclusão do pedido.
10. Repetição da conclusão para validar idempotência.

O roteiro é executado por:

~~~bash
npm run verify:flow
~~~

O comando roda `scripts/verify-flow.mjs` no container `flow-check` (perfil
`tools`, imagem `node:24-alpine`, sem dependências além do Node), que depende
do `nginx-gateway` saudável. O mesmo script pode ser executado do host com
`node scripts/verify-flow.mjs`; a variável `GATEWAY_URL` define o gateway
(padrão `http://localhost:8080`, `http://nginx-gateway` no container).

Regras do roteiro:

- Antes do fluxo, o roteiro valida o gateway (seção 11): um `X-Request-Id`
  válido é devolvido no cabeçalho e no `traceId` do 401 de Pedidos; um valor
  inválido é substituído por um id gerado; `GET /api/v1/products/:id` retorna
  405 `METHOD_NOT_ALLOWED` com `Allow: PUT`; `/internal/` retorna 404
  `ROUTE_NOT_FOUND` mesmo com `X-Internal-Token`.
- Todas as chamadas passam pelo gateway; nenhuma rota `/internal/` chega a um serviço.
- O JWT utilizado é o `accessToken` emitido pelo login do usuário recém
  cadastrado, com e-mail único por execução.
- Cada requisição envia um `X-Request-Id` próprio.
- As projeções de Produto (`GET /api/v1/products?id=`) e de Estoque
  (`GET /api/v1/inventory/:productId`) são aguardadas com polling (até 60
  tentativas a cada 250 ms), pois a consistência é eventual.
- O pedido é validado com `status` `CREATED`, `userId` igual ao `id` do
  usuário cadastrado, `unitPrice` 34.90 e `total` 69.80; a criação sem JWT
  retorna 401.
- A consulta retorna o mesmo pedido criado; a conclusão e a sua repetição
  retornam 200 com o mesmo corpo `COMPLETED`, sem alterar `updatedAt`.
- Ao final, a projeção de estoque deverá convergir de 20 para 18 unidades,
  refletindo o débito feito por Pedidos.

### 12.4 Contrato Swagger

O projeto deverá possuir validação automatizada do documento OpenAPI por meio
do comando:

~~~bash
npm run verify:swagger:products
~~~

Essa validação deverá confirmar a presença das rotas públicas, internas e de
health, dos métodos HTTP, dos filtros `id` e `name` na listagem, do esquema
Bearer JWT, do header `X-Internal-Token` e dos schemas de produto, erro e
health.

Para Auth, `npm run verify:swagger:auth` deverá confirmar o título, as três
rotas da seção 11.1 e somente elas, as respostas 201/400/409/500 do cadastro e
200/400/401/500 do login, a ausência de exigência de JWT, os corpos JSON, os
schemas `RegisterUserDto`, `LoginDto`, `UserResponseDto`, `LoginResponseDto`,
`ErrorResponseDto` e `HealthResponseDto`, a ausência de senha na resposta de
usuário e HTTP 200 em `/auth/docs` e nos recursos da interface.

Para Pedidos, `npm run verify:swagger:orders` deverá confirmar o título, as
quatro rotas da seção 11.1 e somente elas, as respostas
201/400/401/404/409/500/503 da criação, 200/400/401/403/404/500 da consulta e
200/400/401/403/404/409/500 da conclusão (sem 201 e sem corpo), a exigência do
esquema `jwt`, o parâmetro de rota `id`, o corpo `CreateOrderDto` sem `userId`,
os schemas `CreateOrderDto`, `OrderResponseDto`, `ErrorResponseDto` e
`HealthResponseDto` e HTTP 200 em `/orders/docs` e nos recursos da interface.

## 13. Comandos de execução

O README ou a documentação de execução deverá apresentar comandos equivalentes a:

~~~bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build --force-recreate
docker compose --env-file .env -f infra/docker/docker-compose.yml ps
docker compose --env-file .env -f infra/docker/docker-compose.yml logs -f products-service
docker compose --env-file .env -f infra/docker/docker-compose.yml down
npm run verify:swagger:products
npm run verify:swagger:auth
npm run verify:swagger:orders
npm run verify:swagger:inventory
npm run verify:flow:inventory
npm run verify:flow
~~~

Para cada microsserviço, deverá existir comando de teste com cobertura:

~~~bash
npm run test:products
npm run test:auth
npm run test:orders
npm run test:inventory
~~~

O trabalho deverá ser considerado inválido se qualquer microsserviço ficar abaixo da cobertura mínima de 50%.

## 14. Critérios de aceite

- [x] Todos os seis bancos PostgreSQL estão definidos no Compose.
- [ ] Nginx encaminha somente as rotas externas.
- [ ] Rotas "/internal/" não estão expostas pelo Nginx.
- [x] Auth cadastra usuários e emite JWT.
- [ ] Todos os serviços protegidos validam JWT.
- [ ] Produtos possui banco de escrita e banco de leitura.
- [ ] Estoque possui banco de escrita e banco de leitura.
- [ ] Produtos e Estoque utilizam RabbitMQ para projeções.
- [ ] Outbox é gravada na mesma transação dos comandos.
- [x] Pedidos consulta Produtos via REST.
- [x] Pedidos debita Estoque via REST.
- [x] Pedidos possui rota de conclusão.
- [x] Conclusão só pode ser feita pelo proprietário.
- [x] Conclusão repetida é idempotente.
- [ ] Health checks estão configurados.
- [ ] Todas as rotas do serviço de Produtos aparecem corretamente no Swagger.
- [ ] `/docs` e `/docs-json` funcionam quando Swagger está habilitado.
- [ ] Swagger fica desabilitado em produção.
- [ ] Todos os microsserviços possuem testes unitários.
- [ ] Cada microsserviço possui pelo menos 50% de cobertura.
- [ ] Nenhum segredo real está versionado.

## 15. Assumptions

- As rotas utilizam nomes em inglês e o prefixo "/api/v1".
- O pedido possui apenas um produto e uma quantidade.
- O status inicial do pedido é "CREATED".
- A conclusão altera o status para "COMPLETED".
- Não existe rota de cancelamento nesta versão.
- Auth e Pedidos utilizam um banco próprio cada.
- Auth e Pedidos são implementados em TypeScript/NestJS, como Produtos.
- Produtos e Estoque utilizam CQRS.
- A consistência dos bancos de leitura é eventual.
- Rotas internas são protegidas por "X-Internal-Token".
- A implementação é incremental; nesta etapa Auth, Produtos, Estoque e Pedidos estão ativos.

## 16. Estado da implementação inicial

A branch "funcionalidade/produtos-inicial" entrega a primeira fatia vertical
do sistema:

- "services/products" contém o microsserviço NestJS de Produtos.
- "products-write-db" mantém a fonte de escrita e a Outbox.
- "products-read-db" mantém a projeção usada pelas consultas.
- RabbitMQ publica "product.created" e "product.updated" no exchange
  "delivery.events".
- "infra/nginx/nginx.conf" expõe somente as rotas públicas de Produtos e
  bloqueia "/internal/".
- As rotas externas exigem JWT válido em qualquer ambiente; "X-Internal-Token"
  continua obrigatório para a rota interna.
- Swagger/OpenAPI documenta todas as rotas públicas, internas e de health; a
  validação do contrato é executada por "npm run verify:swagger:products".
- A consulta pública de produtos aceita os filtros opcionais `id` exato e
  `name` parcial, combinados com `AND` quando usados juntos.
- A cobertura do serviço de Produtos possui limiar de 50% para branches,
  functions, lines e statements, com suíte unitária independente.

Pedidos foi adicionado na versão 2.4 (seção 19) sem alterar os limites de
dados, rotas internas e contratos definidos nesta especificação.


## 17. Implementação de Estoque (versão 2.0)

`services/inventory` é uma aplicação Java 21 / Spring Boot independente,
construída com Maven. Produtos continua em NestJS. Controllers, casos de uso,
interfaces e adaptadores Spring JDBC são injetados pelo construtor.
`StockRules` concentra as regras de quantidade, saldo e repetição de pedidos.
Há dois DataSources e dois gerenciadores de transação, `writeTransactionManager`
e `readTransactionManager`. Migrações Flyway são executadas antes dos repositórios.

### Contratos e regras

- `POST /api/v1/inventory`: cria ou soma quantidade; retorna 200 com
  `productId`, `availableQuantity`, `updatedAt`.
- `GET /api/v1/inventory/:productId`: consulta apenas a projeção; retorna 200
  ou 404 (`STOCK_NOT_FOUND`) se ainda não existir na leitura.
- `POST /internal/v1/inventory/debit`: retorna 200 com `orderId`, `productId`,
  `debitedQuantity`, `remainingQuantity`. Requer `X-Internal-Token`; token
  ausente/incorreto retorna 403, como em Produtos.
- IDs devem ser UUIDs. Quantidade deve ser inteiro entre 1 e 2147483647.
  Campos desconhecidos e entradas inválidas retornam 400.
- Saldo acima de 2147483647 retorna 409 (`STOCK_LIMIT_EXCEEDED`).
- Débito sem estoque ou maior que o saldo retorna 409 (`INSUFFICIENT_STOCK`).
- Repetição do mesmo `orderId`, produto e quantidade retorna a resposta original,
  sem nova movimentação ou evento. Mesmo pedido com dados diferentes retorna
  409 (`IDEMPOTENCY_CONFLICT`).
- JWT é obrigatório nas rotas públicas de Estoque, inclusive no ambiente local;
  use o login do Auth ou o gerador de JWT do projeto.
- O cadastro de estoque recebe o UUID do produto sem consultar outro banco ou
  serviço; validação da existência do produto não faz parte deste contrato.

### Consistência e concorrência

`stock`, `stock_movements` e `outbox_events` são gravados na mesma transação.
Locks transacionais por produto serializam adições e débitos; locks por pedido
serializam tentativas idempotentes. Há unicidade de `order_id` e restrição de
saldo não negativo no PostgreSQL. Tentativas insuficientes não reservam o pedido.

Cada alteração incrementa a versão do agregado e gera `inventory.stock_added`
ou `inventory.stock_debited`, com payload `{productId, availableQuantity, updatedAt}`.
O worker mantém eventos pendentes até confirmação do RabbitMQ.
Spring AMQP administra a recuperação de conexões; o publicador aguarda confirmação por até cinco segundos. Publicações sem fila de destino também permanecem pendentes. A fila durável
`inventory.read.projector` recebe `inventory.*` no exchange `delivery.events`.
A projeção e o registro de `eventId` processado são transacionais. Eventos
repetidos são ignorados; versões antigas não sobrescrevem versões novas.
O listener Spring AMQP confirma automaticamente somente após a projeção transacional retornar (commit); falhas de persistência são reenviadas.
Mensagens malformadas são rejeitadas sem reenvio, pelo tratamento de erros do listener.

### Infraestrutura e documentação

O Compose `delivery` adiciona Estoque e dois PostgreSQL privados com volumes
`inventory-write-data` e `inventory-read-data`. Nenhuma porta adicional é publicada.
O Nginx encaminha `/api/v1/inventory` e bloqueia `/internal/`.
Swagger interno usa `/docs` e `/docs-json`; pelo gateway, fica em
`/inventory/docs` e `/inventory/docs-json`. Só é habilitado com
`SWAGGER_ENABLED=true` fora de produção. `NODE_ENV=production` e os perfis Spring `prod`/`production` desabilitam Swagger mesmo com a flag ativa. Os recursos estáticos locais são encaminhados por `/inventory/swagger-ui/`. Produtos mantém seus endpoints anteriores.

Configuração: `INVENTORY_PORT`, `INVENTORY_WRITE_DB_{HOST,PORT,NAME,USER,PASSWORD}`,
`INVENTORY_READ_DB_{HOST,PORT,NAME,USER,PASSWORD}`, `RABBITMQ_INVENTORY_QUEUE`,
`RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`
e `SWAGGER_ENABLED`. Exemplos locais ficam em `.env.example`.

Validação:

~~~bash
npm run typecheck
npm run test:inventory
npm run test:products
npm run build:inventory
npm run infra:up
npm run verify:swagger:products
npm run verify:swagger:inventory
npm run verify:flow:inventory
~~~

O roteiro de fluxo cria dados de teste com UUIDs novos: verifica JWT, token
interno, bloqueio pelo gateway, adição, projeção, dez débitos simultâneos do
mesmo pedido, débitos concorrentes com estoque limitado, movimentações, Outbox
e evento antigo. Execute-o em ambiente de desenvolvimento/teste.
A suíte própria exige ao menos 50% nas quatro métricas JaCoCo definidas na seção 12.1.
O fluxo completo da seção 12.3, com Pedidos, é um roteiro separado.


### 17.1 Preservação dos dados da versão NestJS

Os nomes, colunas e restrições das tabelas permanecem compatíveis com a v1.9.
Flyway usa baseline 0 para bancos existentes e migrações V1 idempotentes que
criam apenas tabelas/índices ausentes. A antiga tabela `migrations` do TypeORM
é preservada. Não há limpeza de volumes nem cópia entre bancos.

Antes de atualizar um ambiente com dados importantes, faça backup dos dois
bancos. Recrie apenas a aplicação com a imagem Java e mantenha os volumes.
Não use `docker compose down --volumes` nesse ambiente. Os testes automatizados
preparam o esquema antigo com saldo, projeção e débito e confirmam que o novo
serviço mantém o saldo e reconhece o pedido já processado.

### 17.2 Build e validação

- JDK 21 e Maven 3.9+ para execução fora do Docker.
- `mvn -f services/inventory/pom.xml test`: testes unitários, sem Docker.
- `mvn -f services/inventory/pom.xml verify`: unitários + integração PostgreSQL
  com Testcontainers + cobertura JaCoCo. Exige Docker; os testes não são omitidos
  silenciosamente quando ele está indisponível.
- `mvn -f services/inventory/pom.xml -DskipTests package`: gera o JAR executável.
- Relatório: `services/inventory/target/site/jacoco/index.html`.
- O Dockerfile compila com Maven/JDK 21 e executa somente Java no estágio final.
- O health check usa `wget` em `/health`; a porta interna continua 3000.
- `npm run verify:flow:inventory` usa o container auxiliar `inventory-check`,
  ativado apenas pelo perfil Compose `tools`. Ele contém Node para executar o
  roteiro já existente; o serviço de Estoque não depende de Node.
- Os únicos workspaces npm são os serviços TypeScript: Produtos, Auth e Pedidos.

### 17.3 Mapa das classes para estudo

Veja `services/inventory/README.md`: o fluxo principal é
`InventoryController → AddStockUseCase → StockWriteRepository → StockWriteJdbcRepository`.
`StockRules` contém as regras, executadas dentro da transação pelo adaptador
quando dependem do saldo. `OutboxPublisherWorker` publica eventos e
`StockReadProjectorConsumer` atualiza o banco de leitura.


## 18. Implementação de Auth (versão 2.2)

`services/auth` é um workspace npm NestJS independente. O fluxo principal é
`AuthController → RegisterUserUseCase/LoginUseCase → portas
(USER_REPOSITORY, PASSWORD_HASHER, TOKEN_ISSUER)`, implementadas por
`TypeOrmUserRepository`, `BcryptPasswordHasher` e `JwtTokenIssuer`, todas
registradas no `AuthModule` por injeção de dependências.

### Contratos e regras

- `POST /api/v1/auth/register`: 201 com `id`, `name`, `email` e `createdAt`.
  A senha e o hash nunca são retornados.
- `POST /api/v1/auth/login`: 200 com `accessToken`, `tokenType` (`Bearer`),
  `expiresIn` (segundos) e `user` (`id`, `name`, `email`).
- Códigos de erro: `VALIDATION_ERROR` (400), `EMAIL_ALREADY_REGISTERED` (409),
  `INVALID_CREDENTIALS` (401) e `INTERNAL_SERVER_ERROR` (500). Erros 5xx
  retornam a mensagem genérica "Erro interno do servidor", sem detalhes
  internos. O `traceId` vem de `X-Request-Id` ou é gerado quando ausente.
- O e-mail é normalizado (espaços removidos e letras minúsculas) no cadastro e
  no login.
- A senha é armazenada com bcryptjs, custo 10. No login com e-mail
  inexistente, a senha é comparada com um hash fictício para não revelar, pelo
  tempo de resposta, quais e-mails estão cadastrados.
- O JWT é assinado com HS256 e `JWT_SECRET` e contém `sub` (id do usuário),
  `email`, `iat` e `exp`. `JWT_EXPIRES_IN` inválido impede a inicialização.
- O serviço não registra corpo de requisições, senhas ou tokens em log.

### Dados

"auth-db" (PostgreSQL 16, volume `auth-data`, sem porta publicada) contém a
tabela `users` (`id` uuid, `name` varchar(120), `email` varchar(254) único,
`password_hash` varchar(100), `created_at` timestamptz). A unicidade do e-mail
é garantida pelo banco; uma violação concorrente (`23505`) também retorna 409.

### Configuração e validação

Variáveis: `AUTH_PORT`, `AUTH_DB_{HOST,PORT,NAME,USER,PASSWORD}`,
`JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV` e `SWAGGER_ENABLED`.

~~~bash
npm run test:auth
npm run infra:up
npm run verify:swagger:auth
~~~

A suíte de Auth cobre os casos da seção 12.2 com portas mockadas, validação
dos DTOs, geração e validação de JWT, hash bcrypt, mapeamento de erros HTTP
com Supertest, repositório TypeORM e contrato OpenAPI, com limiar Jest de 50%.


## 19. Implementação de Pedidos (versão 2.4)

`services/orders` é um workspace npm NestJS independente. O fluxo principal é
`OrdersController → CreateOrderUseCase/GetOrderUseCase/CompleteOrderUseCase →
portas (ORDER_REPOSITORY, PRODUCTS_CLIENT, INVENTORY_CLIENT)`, implementadas por
`TypeOrmOrderRepository`, `ProductsHttpClient` e `InventoryHttpClient`, todas
registradas no `OrdersModule` por injeção de dependências. As regras de total,
propriedade e transição de status ficam em `domain/order.ts`.

### Contratos e regras

- `POST /api/v1/orders`: 201 com o pedido `CREATED` (seção 3.8).
- `GET /api/v1/orders/:id`: 200 somente para o proprietário (seção 3.9).
- `POST /api/v1/orders/:id/complete`: 200, idempotente (seção 3.10).
- `GET /health`: `service` igual a `orders-service`.
- Códigos de erro: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401),
  `ORDER_FORBIDDEN` (403), `ORDER_NOT_FOUND` e `PRODUCT_NOT_FOUND` (404),
  `PRODUCT_INACTIVE`, `INSUFFICIENT_STOCK` e `INVALID_ORDER_STATUS` (409),
  `DEPENDENCY_UNAVAILABLE` (503) e `INTERNAL_SERVER_ERROR` (500). A mensagem
  de 503 identifica apenas a dependência; os demais 5xx retornam "Erro interno
  do servidor".
- O JWT é validado localmente com `JWT_SECRET` (HS256); o `userId` é o claim
  `sub`, que deverá ser texto não vazio.
- Os clientes REST usam `fetch` com `AbortSignal.timeout`, `X-Internal-Token`
  e `X-Request-Id`; o token interno nunca é registrado em log.

### Dados

"orders-db" (PostgreSQL 16, volume `orders-data`, sem porta publicada) contém a
tabela `orders` (`id` uuid, `user_id` uuid indexado, `product_id` uuid,
`quantity` integer > 0, `unit_price` numeric(12,2), `total` numeric(20,2),
`status` varchar(20) restrito a `CREATED`/`COMPLETED`, `created_at` e
`updated_at` timestamptz). Pedidos não acessa bancos de Produtos ou Estoque.

### Configuração e validação

Variáveis: `ORDERS_PORT`, `ORDERS_DB_{HOST,PORT,NAME,USER,PASSWORD}`,
`PRODUCTS_SERVICE_URL`, `INVENTORY_SERVICE_URL`, `ORDERS_HTTP_TIMEOUT_MS`,
`JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, `NODE_ENV` e `SWAGGER_ENABLED`.

~~~bash
npm run test:orders
npm run infra:up
npm run verify:swagger:orders
~~~

A suíte de Pedidos cobre os 14 casos da seção 12.2 com repositório e clientes
REST mockados, o guard JWT e o mapeamento de erros HTTP com Supertest, os
clientes REST com `fetch` mockado (timeout, falha de rede, 5xx e respostas
inesperadas), o repositório TypeORM e o contrato OpenAPI, com limiar Jest de 50%.
