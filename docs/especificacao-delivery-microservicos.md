# Especificação do Sistema de Delivery com Microsserviços

**Status:** especificação de referência para implementação
**Versão:** 1.3
**Última atualização:** 2026-09-17
**Idioma:** português
**Objetivo:** orientar a construção, execução e validação de um sistema simples de delivery com foco em DevOps.

## Histórico de alterações

| Versão | Data | Alteração |
|---|---|---|
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
- Injeção de dependências com NestJS.
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
| Linguagem | TypeScript |
| Runtime | Node.js |
| Framework | NestJS |
| Persistência | PostgreSQL |
| ORM | TypeORM |
| Mensageria | RabbitMQ |
| Gateway | Nginx |
| Empacotamento | Docker e Docker Compose |
| Testes | Jest e Supertest |

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
| GET | /api/v1/products/:id | Produtos | JWT | Consultar produto |
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
- Senha com formato inválido deverá retornar 400.
- E-mail já cadastrado deverá retornar 409.

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

Credenciais inválidas deverão retornar 401.

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

### 3.5 Consultar produto

#### Requisição

GET /api/v1/products/:id

#### Resposta 200 OK

~~~json
{
  "id": "4e1d9d5b-14b7-4599-9f8b-1b6d0f4e4c20",
  "name": "Hambúrguer artesanal especial",
  "description": "Hambúrguer com queijo, bacon e molho especial",
  "price": 34.90,
  "active": true,
  "updatedAt": "2026-09-16T15:10:00.000Z"
}
~~~

Essa rota deverá consultar exclusivamente "products-read-db". Como o modelo de leitura é eventualmente consistente, uma criação ou edição poderá levar alguns instantes para aparecer nessa rota.

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

O usuário somente poderá consultar os próprios pedidos. Pedido inexistente deverá retornar 404 e pedido de outro usuário deverá retornar 403.

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
- Pedido inexistente deverá retornar 404.
- Usuário diferente do proprietário deverá receber 403.
- Pedido em estado inválido deverá retornar 409.
- Pedido já concluído deverá retornar 200 com status "COMPLETED", sem duplicar alterações.

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
- "infrastructure": TypeORM, RabbitMQ, clientes REST e adaptadores.

Regras obrigatórias:

- Controllers dependem somente de casos de uso.
- Casos de uso dependem de interfaces, não de implementações concretas.
- Repositórios TypeORM devem ser registrados com tokens.
- Bancos de leitura e escrita devem possuir conexões nomeadas.
- Clientes REST devem ser providers injetáveis.
- Publicadores e consumidores RabbitMQ devem ser providers injetáveis.
- Configurações devem ser obtidas pelo "ConfigService".
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
- Rotas internas deverão exigir "X-Internal-Token".
- O token interno deverá ser diferente do segredo utilizado para JWT.
- Tokens, senhas e secrets nunca poderão aparecer nos logs.

### 9.1 Exceção temporária da implementação inicial

Enquanto o microsserviço Auth não estiver implementado, o serviço de Produtos
deverá aceitar a variável "AUTH_ENABLED=false" exclusivamente no Compose local
inicial. Nesse modo, as rotas externas de Produtos ficam sem a validação JWT
para permitir a demonstração da fatia vertical.

Quando "AUTH_ENABLED=true" (valor obrigatório para qualquer ambiente
compartilhado, homologação ou produção), o serviço deverá exigir um JWT válido
assinado com "JWT_SECRET". O bypass não poderá ser usado para contornar a
autenticação em produção.

A rota "/internal/v1/products/:id" sempre deverá exigir "X-Internal-Token",
independentemente de "AUTH_ENABLED".

## 10. Docker Compose e configuração

Na implementação inicial do microsserviço de Produtos, o arquivo
`infra/docker/docker-compose.yml` deverá conter somente:

- "nginx-gateway"
- "products-service"
- "products-write-db"
- "products-read-db"
- "rabbitmq"

Auth, Estoque, Pedidos e os demais bancos serão adicionados em etapas
posteriores. Na versão completa do sistema, o Compose deverá conter:

- "nginx-gateway"
- "auth-service"
- "products-service"
- "inventory-service"
- "orders-service"
- "rabbitmq"
- "auth-db"
- "orders-db"
- "products-write-db"
- "products-read-db"
- "inventory-write-db"
- "inventory-read-db"

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

Variáveis de ambiente mínimas:

~~~text
NODE_ENV
PORT
DATABASE_HOST
DATABASE_PORT
DATABASE_NAME
DATABASE_USER
DATABASE_PASSWORD
READ_DATABASE_HOST
READ_DATABASE_PORT
READ_DATABASE_NAME
READ_DATABASE_USER
READ_DATABASE_PASSWORD
RABBITMQ_URL
JWT_SECRET
JWT_EXPIRES_IN
INTERNAL_SERVICE_TOKEN
PRODUCTS_SERVICE_URL
INVENTORY_SERVICE_URL
ORDERS_SERVICE_URL
~~~

As credenciais deverão ser fornecidas por ".env.example" sem valores reais.

## 11. Nginx Gateway

Na versão completa, o Nginx deverá encaminhar:

~~~text
/api/v1/auth/       -> auth-service
/api/v1/products    -> products-service
/api/v1/inventory   -> inventory-service
/api/v1/orders      -> orders-service
~~~

Na implementação inicial, somente "/api/v1/products" deverá ser encaminhado
para "products-service". Nenhuma rota "/internal/" deverá ser encaminhada.

O Nginx deverá:

- Preservar o método HTTP e o corpo JSON.
- Encaminhar "Authorization" e "X-Request-Id".
- Gerar "X-Request-Id" quando o cliente não enviar um.
- Não encaminhar "/internal/".
- Não publicar bancos ou RabbitMQ.
- Retornar erro controlado quando o serviço de destino estiver indisponível.

## 12. Testes

Cada microsserviço deverá possuir testes unitários independentes.

### 12.1 Meta de cobertura

A configuração do Jest deverá impedir cobertura inferior a 50% em cada serviço:

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

## 13. Comandos de execução

O README ou a documentação de execução deverá apresentar comandos equivalentes a:

~~~bash
docker compose up --build
docker compose ps
docker compose logs -f orders-service
docker compose down
~~~

Para cada microsserviço, deverá existir comando de teste equivalente a:

~~~bash
npm test -- --coverage
~~~

O trabalho deverá ser considerado inválido se qualquer microsserviço ficar abaixo da cobertura mínima de 50%.

## 14. Critérios de aceite

- [ ] Todos os seis bancos PostgreSQL estão definidos no Compose.
- [ ] Nginx encaminha somente as rotas externas.
- [ ] Rotas "/internal/" não estão expostas pelo Nginx.
- [ ] Auth cadastra usuários e emite JWT.
- [ ] Todos os serviços protegidos validam JWT.
- [ ] Produtos possui banco de escrita e banco de leitura.
- [ ] Estoque possui banco de escrita e banco de leitura.
- [ ] Produtos e Estoque utilizam RabbitMQ para projeções.
- [ ] Outbox é gravada na mesma transação dos comandos.
- [ ] Pedidos consulta Produtos via REST.
- [ ] Pedidos debita Estoque via REST.
- [ ] Pedidos possui rota de conclusão.
- [ ] Conclusão só pode ser feita pelo proprietário.
- [ ] Conclusão repetida é idempotente.
- [ ] Health checks estão configurados.
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
- Produtos e Estoque utilizam CQRS.
- A consistência dos bancos de leitura é eventual.
- Rotas internas são protegidas por "X-Internal-Token".
- A implementação é incremental; nesta etapa somente Produtos está ativo.

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
- "AUTH_ENABLED=false" é usado apenas pelo Compose local enquanto Auth não
  existe; "X-Internal-Token" continua obrigatório para a rota interna.
- A cobertura do serviço de Produtos possui limiar de 50% para branches,
  functions, lines e statements, com suíte unitária independente.

As próximas implementações deverão adicionar Auth, Estoque e Pedidos sem
alterar os limites de dados, rotas internas e contratos definidos nesta
especificação.
