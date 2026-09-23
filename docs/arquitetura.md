# Arquitetura do Sistema de Delivery

Visão geral resumida do sistema. Os contratos completos (rotas, corpos, códigos
de erro, variáveis e critérios de aceite) estão na
[especificação](especificacao-delivery-microservicos.md), que é a fonte de
verdade. O passo a passo de demonstração está no
[roteiro de apresentação](roteiro-apresentacao.md).

## 1. Escopo

Sistema simples de delivery com foco em DevOps: cadastro e login de usuários,
cadastro e consulta de produtos, controle de estoque e criação, consulta e
conclusão de pedidos (um produto por pedido).

Fora do escopo: pagamento, cancelamento, entrega, frontend, deploy em nuvem,
pipeline de CI e perfis de autorização.

## 2. Visão geral

~~~mermaid
flowchart LR
    Client[Cliente / Insomnia] -->|HTTP :8080| Nginx[nginx-gateway]
    Nginx --> Auth[auth-service]
    Nginx --> Products[products-service]
    Nginx --> Inventory[inventory-service]
    Nginx --> Orders[orders-service]

    Orders -- "REST interno + X-Internal-Token" --> Products
    Orders -- "REST interno + X-Internal-Token" --> Inventory

    Auth --> AuthDB[(auth-db)]
    Orders --> OrdersDB[(orders-db)]

    Products --> PW[(products-write-db)]
    PW -. Outbox .-> Rabbit{{RabbitMQ<br/>delivery.events}}
    Rabbit -.-> PR[(products-read-db)]
    Products --> PR

    Inventory --> IW[(inventory-write-db)]
    IW -. Outbox .-> Rabbit
    Rabbit -.-> IR[(inventory-read-db)]
    Inventory --> IR
~~~

São 12 containers orquestrados por Docker Compose
(`infra/docker/docker-compose.yml`) em uma rede bridge privada. **Somente o
Nginx publica porta** (8080 no host); bancos, RabbitMQ e os serviços ficam
acessíveis apenas dentro da rede, pelos nomes dos containers.

## 3. Componentes

| Componente | Stack | Dados | Responsabilidade |
|---|---|---|---|
| `nginx-gateway` | Nginx 1.27 | — | Porta de entrada, roteamento, `X-Request-Id`, erros JSON |
| `auth-service` | NestJS + TypeORM | `auth-db` | Cadastro, login e emissão de JWT |
| `products-service` | NestJS + TypeORM | `products-write-db`, `products-read-db` | Criar, editar e consultar produtos (CQRS) |
| `inventory-service` | Java 21 + Spring Boot 3.5, Spring JDBC, Flyway | `inventory-write-db`, `inventory-read-db` | Adicionar, consultar e debitar estoque (CQRS) |
| `orders-service` | NestJS + TypeORM | `orders-db` | Criar, consultar e concluir pedidos; orquestra Produtos e Estoque |
| `rabbitmq` | RabbitMQ 3.13 | volume `rabbitmq-data` | Transporte de eventos para os modelos de leitura |

Princípio central: **cada serviço é dono dos próprios dados** e nenhum serviço
acessa o banco de outro. A integração entre serviços é REST síncrono; o
RabbitMQ é usado somente para atualizar projeções de leitura.

## 4. Rotas e gateway

| Método | Rota externa | Serviço | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Auth | Pública |
| POST | `/api/v1/auth/login` | Auth | Pública |
| POST / GET | `/api/v1/products` (filtros `id`, `name`) | Produtos | JWT |
| PUT | `/api/v1/products/:id` | Produtos | JWT |
| POST | `/api/v1/inventory` | Estoque | JWT |
| GET | `/api/v1/inventory/:productId` | Estoque | JWT |
| POST | `/api/v1/orders` | Pedidos | JWT |
| GET | `/api/v1/orders/:id` | Pedidos | JWT |
| POST | `/api/v1/orders/:id/complete` | Pedidos | JWT |

Rotas internas (somente na rede Docker, chamadas por Pedidos):
`GET /internal/v1/products/:id` e `POST /internal/v1/inventory/debit`. Cada
serviço expõe ainda `GET /health`, usado pelos health checks do Compose.

Comportamento do gateway (`infra/nginx/nginx.conf`):

- Encaminha apenas as rotas externas; `/internal/` e rotas não mapeadas
  retornam **404 `ROUTE_NOT_FOUND`**.
- `/api/v1/products/:id` aceita só `PUT`; outros métodos retornam
  **405 `METHOD_NOT_ALLOWED`**.
- Serviço fora do ar (502/503/504 do upstream) vira **503
  `SERVICE_UNAVAILABLE`**.
- Descarta qualquer `X-Internal-Token` vindo do cliente.
- Swagger por serviço (somente com `SWAGGER_ENABLED=true` fora de produção):
  `/docs` (Produtos), `/auth/docs`, `/inventory/docs` e `/orders/docs`.

## 5. Autenticação e segurança

- **Usuários:** senha armazenada com bcrypt (bcryptjs, custo 10), nunca
  retornada; e-mail único e normalizado. Login com e-mail inexistente compara
  contra um hash fictício para não vazar, pelo tempo, quais e-mails existem.
- **JWT externo:** Auth assina com HS256 e `JWT_SECRET` (claims `sub`, `email`,
  `iat`, `exp`; validade `JWT_EXPIRES_IN`). Produtos, Estoque e Pedidos
  validam o token **localmente** com o mesmo segredo, sem chamar o Auth. Não há
  bypass em nenhum ambiente.
- **Chamadas internas:** exigem `X-Internal-Token` (`INTERNAL_SERVICE_TOKEN`,
  diferente do `JWT_SECRET`); token ausente ou incorreto retorna 403.
- **Autorização de pedidos:** o `userId` vem do claim `sub`, nunca do corpo;
  só o proprietário consulta ou conclui (outro usuário recebe 403).
- **RabbitMQ:** um usuário por serviço (`products`, `inventory`) com permissões
  restritas ao exchange e às próprias filas (`infra/rabbitmq/definitions.json`);
  sem usuário padrão e sem painel de gerenciamento publicado.
- **Segredos:** somente `.env.example` com valores de desenvolvimento é
  versionado; senhas, tokens e corpos de requisição não são registrados em log.

## 6. Dados e estratégia de storage

Seis instâncias PostgreSQL 16 (uma por banco lógico), cada uma com **volume
nomeado** do Docker, preservado entre recriações de containers
(`docker compose down` mantém os dados; `down --volumes` apaga).

| Banco | Volume | Tabelas principais |
|---|---|---|
| `auth-db` | `auth-data` | `users` |
| `orders-db` | `orders-data` | `orders` |
| `products-write-db` | `products-write-data` | `products`, `outbox_events` |
| `products-read-db` | `products-read-data` | `products_projection`, `processed_events` |
| `inventory-write-db` | `inventory-write-data` | `stock`, `stock_movements`, `outbox_events` |
| `inventory-read-db` | `inventory-read-data` | `stock_projection`, `processed_events` |

- Esquemas criados por migrações executadas na inicialização de cada serviço
  (TypeORM nos serviços NestJS, Flyway em Estoque).
- Integridade garantida também no banco: e-mail único, `order_id` único nas
  movimentações, saldo não negativo, status restrito a `CREATED`/`COMPLETED`.
- Valores monetários em `numeric`; o total do pedido é calculado em centavos
  inteiros.
- O RabbitMQ persiste exchange, filas duráveis e mensagens no volume
  `rabbitmq-data`.

## 7. CQRS, Outbox e mensageria

Produtos e Estoque separam escrita e leitura:

1. O comando abre uma transação no banco de escrita, altera o dado principal e
   grava o evento em `outbox_events` **na mesma transação**.
2. Um worker lê a Outbox, publica no exchange topic durável `delivery.events`
   com publisher confirms e marca `published_at`. Se o RabbitMQ estiver fora, o
   evento permanece pendente e é reenviado.
3. O consumidor da fila (`products.read.projector` ou
   `inventory.read.projector`) atualiza a projeção e registra o `eventId` em
   `processed_events` na mesma transação; só então confirma (ack) a mensagem.
4. Eventos repetidos são ignorados (idempotência por `eventId`) e versões
   antigas não sobrescrevem versões novas.

Eventos: `product.created`, `product.updated`, `inventory.stock_added`,
`inventory.stock_debited`, todos no envelope `{eventId, eventType,
aggregateId, occurredAt, version, payload}`.

Consequência: **as consultas (GET) leem apenas os bancos de leitura e são
eventualmente consistentes** — uma criação pode levar alguns milissegundos para
aparecer na listagem.

## 8. Fluxos de negócio

**Criação de pedido** (`POST /api/v1/orders`):

1. Nginx encaminha para Pedidos, que valida o JWT e extrai `userId` de `sub`.
2. Pedidos consulta `GET /internal/v1/products/:id` (Produtos lê a projeção).
   Inexistente → 404; inativo → 409 `PRODUCT_INACTIVE`, sem debitar.
3. Pedidos gera o `orderId` e chama `POST /internal/v1/inventory/debit`.
   Estoque debita com lock por produto, grava movimentação e Outbox; saldo
   insuficiente → 409 `INSUFFICIENT_STOCK`. O débito é **idempotente por
   `orderId`**.
4. Pedidos grava o pedido com o preço consultado e retorna 201 `CREATED`.

Timeout (`ORDERS_HTTP_TIMEOUT_MS`, padrão 3000 ms), falha de conexão ou 5xx de
uma dependência → 503 `DEPENDENCY_UNAVAILABLE`. Se a gravação falhar após o
débito, Pedidos tenta mais uma vez com o mesmo `orderId` e, persistindo a
falha, registra `orderId` e `traceId` para reconciliação manual (não há
compensação automática nesta versão).

**Conclusão** (`POST /api/v1/orders/:id/complete`): valida JWT e propriedade,
aplica `CREATED → COMPLETED` com atualização condicional. Repetir a conclusão
retorna 200 com o mesmo corpo, sem nova alteração.

## 9. Logs, rastreabilidade e erros

- **Destino:** todos os containers escrevem em stdout/stderr e os logs são
  coletados pelo driver padrão do Docker (`docker compose logs -f <serviço>`).
  Não há agregador centralizado nesta versão.
- **Gateway:** log de acesso no formato `gateway` com método, rota, status,
  `request_id` e `upstream` que atendeu.
- **Correlação:** o Nginx repassa o `X-Request-Id` do cliente (se válido) ou
  gera um; o valor chega ao serviço, é propagado por Pedidos às chamadas
  internas, é devolvido no cabeçalho da resposta e aparece como `traceId` nos
  erros e nas linhas de log relevantes.
- **Serviços:** Logger do NestJS e SLF4J no Spring registram eventos
  operacionais — dependência indisponível (`service`, `reason`, `traceId`),
  resposta inesperada, falha de gravação após débito, eventos mantidos na
  Outbox e mensagens rejeitadas pelo consumidor.
- **Formato de erro** único em todos os serviços e no gateway:
  `{status, code, message, path, traceId, timestamp}`. Erros 5xx retornam
  mensagem genérica, sem stack trace ou credenciais.

## 10. Organização do código e injeção de dependências

Cada serviço segue camadas (NestJS em `src/modules/<modulo>/`, Java em
`br.com.delivery.inventory`):

- `presentation`: controllers, DTOs e validação.
- `application`: casos de uso e portas (interfaces).
- `domain`: entidades e regras (ex.: `order.ts`, `StockRules.java`).
- `infrastructure`: repositórios, clientes REST, RabbitMQ, guard JWT.

Controllers dependem de casos de uso, que dependem de interfaces. No NestJS, as
portas são tokens `Symbol` registrados com `useClass`
(ex.: `ORDER_REPOSITORY`, `PRODUCTS_CLIENT`); no Spring, beans injetados pelo
construtor. Nada é instanciado manualmente, o que permite trocar as
implementações por mocks nos testes. Não há código compartilhado entre
serviços.

## 11. Qualidade e verificação

| Nível | Ferramenta | Comando |
|---|---|---|
| Unitário + cobertura ≥ 50% | Jest/Supertest | `npm run test:{products,auth,orders}` |
| Unitário + integração + cobertura ≥ 50% | JUnit 5, Mockito, Testcontainers, JaCoCo | `npm run test:inventory` |
| Contrato OpenAPI | scripts Node | `npm run verify:swagger:{products,auth,orders,inventory}` |
| Fluxo de Estoque (concorrência, Outbox) | container `inventory-check` | `npm run verify:flow:inventory` |
| Ponta a ponta pelo gateway | container `flow-check` | `npm run verify:flow` |

Cobertura de branches verificada: Produtos 85,7%, Auth 97,7%, Pedidos 98,9%,
Estoque 95,6%.

## 12. Execução

~~~bash
cp .env.example .env
npm install
npm run infra:up      # docker compose up --build --force-recreate
npm run verify:flow   # valida o sistema de ponta a ponta
npm run infra:down
~~~

Todos os containers possuem health check, e cada serviço só sobe depois que
suas dependências estão saudáveis (Pedidos aguarda `orders-db`, Produtos e
Estoque). Os containers auxiliares de verificação só sobem com o perfil
`tools`. A configuração vem de variáveis de ambiente por serviço (seção 10 da
especificação).
