# Roteiro de Apresentação do Sistema

Passo a passo para demonstrar o sistema em execução, com testes manuais pelo
Insomnia (ou equivalente) e verificações automatizadas ponta a ponta. A visão
geral da arquitetura está em [arquitetura.md](arquitetura.md) e os contratos
completos na [especificação](especificacao-delivery-microservicos.md).

Material de apoio:

| Arquivo | Uso |
|---|---|
| [`docs/insomnia-delivery.json`](insomnia-delivery.json) | Coleção Insomnia com as 34 requisições deste roteiro, na mesma ordem |
| [`scripts/demo-manual.sh`](../scripts/demo-manual.sh) | Executa o roteiro manual via `curl`, imprimindo cada resposta e conferindo o HTTP esperado |
| [`scripts/verify-flow.mjs`](../scripts/verify-flow.mjs) | Teste ponta a ponta com asserções (`npm run verify:flow`) |

Nos comandos abaixo, `dc` é um atalho para o Compose do projeto:

~~~bash
alias dc='docker compose --env-file .env -f infra/docker/docker-compose.yml'
~~~

(No fish: `alias dc 'docker compose --env-file .env -f infra/docker/docker-compose.yml'`.)

## 0. Preparação (antes da apresentação)

~~~bash
cp .env.example .env          # valores de desenvolvimento
npm install
npm run infra:up              # build + recriação dos 12 containers
dc ps                         # todos devem estar "healthy"
~~~

Pontos a mostrar:

- `dc ps`: 12 containers `healthy`; **somente o `nginx-gateway` publica porta**
  (`0.0.0.0:8080->80`). Bancos e RabbitMQ aparecem apenas com portas internas.
- `infra/docker/docker-compose.yml`: health checks, `depends_on` com
  `condition: service_healthy` e volumes nomeados dos seis bancos.

### Importar a coleção no Insomnia

1. **Import** → arquivo `docs/insomnia-delivery.json`.
2. Selecione o ambiente **Local (gateway :8080)**.
3. As variáveis `token`, `token_b`, `product_id` e `order_id` são preenchidas
   automaticamente a partir das respostas (response chaining) de
   *1.4 Login A*, *1.7 Login B*, *2.2 Criar produto* e *4.1 Criar pedido*.
   Execute essas requisições antes das que dependem delas.
4. Para repetir a apresentação do zero, troque `email_a` e `email_b` no
   ambiente (ou siga direto para o login: o cadastro repetido retorna 409).

Sem Insomnia: `bash scripts/demo-manual.sh --pausa` executa os mesmos passos,
aguardando Enter entre eles.

## 1. Documentação das APIs (Swagger)

Abra no navegador, todas pelo gateway:

| Serviço | Interface | Documento OpenAPI |
|---|---|---|
| Produtos | http://localhost:8080/docs | `/docs-json` |
| Auth | http://localhost:8080/auth/docs | `/auth/docs-json` |
| Estoque | http://localhost:8080/inventory/docs | `/inventory/docs-json` |
| Pedidos | http://localhost:8080/orders/docs | `/orders/docs-json` |

Mostrar: rotas internas aparecem documentadas com tag própria (e continuam
bloqueadas no gateway, passo 6); o esquema Bearer JWT; Swagger fica desligado
com `NODE_ENV=production`.

## 2. Autenticação (pasta *1. Auth*)

| # | Requisição | Esperado | O que destacar |
|---|---|---|---|
| 1.1 | `POST /api/v1/auth/register` `{name, email, password}` | **201** | Resposta sem senha |
| 1.2 | Mesmo cadastro | **409** `EMAIL_ALREADY_REGISTERED` | Unicidade de e-mail |
| 1.3 | Senha `"123"` | **400** `VALIDATION_ERROR` | Validação de entrada |
| 1.4 | `POST /api/v1/auth/login` | **200** `accessToken`, `expiresIn: 3600` | Copie o token em jwt.io: `sub`, `email`, `iat`, `exp`, HS256 |
| 1.5 | Senha errada | **401** `INVALID_CREDENTIALS` | Não revela se o e-mail existe |
| 1.6–1.7 | Cadastro e login do usuário B | 201 / 200 | Usado no teste de autorização |

Mostrar no banco que a senha é hash bcrypt:

~~~bash
dc exec -T auth-db psql -U auth -d auth -c "select email, left(password_hash,7) as hash from users"
# hash começa com $2b$10$  (bcrypt, custo 10)
~~~

## 3. Produtos e CQRS (pasta *2. Produtos*)

| # | Requisição | Esperado | O que destacar |
|---|---|---|---|
| 2.1 | `GET /api/v1/products` sem token | **401** `UNAUTHORIZED` | JWT obrigatório, validado localmente |
| 2.2 | `POST /api/v1/products` (29.90) | **201** | Grava no banco de escrita + Outbox |
| 2.3 | `PUT /api/v1/products/{{product_id}}` (34.90) | **200** | Gera `product.updated` |
| 2.4 | Preço `-1` | **400** `VALIDATION_ERROR` | |
| 2.5–2.7 | Listar, `?id=`, `?name=especial` | **200** | Lê só `products-read-db` (projeção) |

Bastidores do CQRS (Outbox → RabbitMQ → projeção):

~~~bash
# Eventos gravados na mesma transação e marcados como publicados
dc exec -T products-write-db psql -U products -d products_write \
  -c "select event_type, aggregate_id, published_at is not null as publicado from outbox_events order by occurred_at desc limit 3"
# Projeção e idempotência do consumidor
dc exec -T products-read-db psql -U products -d products_read \
  -c "select id, name, price, active from products_projection order by updated_at desc limit 3" \
  -c "select count(*) as eventos_processados from processed_events"
# Filas duráveis com consumidor ativo e sem mensagens pendentes
dc exec -T rabbitmq rabbitmqctl list_queues name messages consumers
~~~

## 4. Estoque (pasta *3. Estoque*)

| # | Requisição | Esperado | O que destacar |
|---|---|---|---|
| 3.1 | `POST /api/v1/inventory` `{productId, quantity: 20}` | **200** `availableQuantity: 20` | Serviço Java/Spring, mesmo contrato de erros |
| 3.2 | `GET /api/v1/inventory/{{product_id}}` | **200** | Lê `inventory-read-db` |

## 5. Pedidos e comunicação entre serviços (pasta *4. Pedidos*)

| # | Requisição | Esperado | O que destacar |
|---|---|---|---|
| 4.1 | `POST /api/v1/orders` `{productId, quantity: 2}` | **201** `CREATED`, `unitPrice 34.9`, `total 69.8` | Pedidos → Produtos (preço) → Estoque (débito) via REST interno |
| 4.2 | `quantity: 1000` | **409** `INSUFFICIENT_STOCK` | Erro repassado do Estoque |
| 4.3 | Produto `0000…` | **404** `PRODUCT_NOT_FOUND` | |
| 4.4 | Corpo com `userId` | **400** `VALIDATION_ERROR` | `userId` vem só do `sub` do JWT |
| 4.5 | `GET /api/v1/orders/{{order_id}}` | **200** | |
| 4.6 | Mesmo GET com `token_b` | **403** `ORDER_FORBIDDEN` | Autorização por proprietário |
| 4.7 | Concluir com `token_b` | **403** `ORDER_FORBIDDEN` | |
| 4.8 | `POST /api/v1/orders/{{order_id}}/complete` | **200** `COMPLETED` | |
| 4.9 | Repetir a conclusão | **200**, mesmo corpo e `updatedAt` | Idempotência |
| 4.10 | `GET /api/v1/inventory/{{product_id}}` | **200** `availableQuantity: 18` | Débito refletido na projeção via RabbitMQ |
| 4.11–4.12 | Desativar produto; criar pedido | 200 / **409** `PRODUCT_INACTIVE` | Nada é debitado |
| 4.13 | Reativar produto | 200 | Prepara o passo de resiliência |

Bastidores:

~~~bash
# Movimentações do Estoque: adição e débito vinculado ao orderId
dc exec -T inventory-write-db psql -U inventory -d inventory_write \
  -c "select kind, quantity, remaining_quantity, order_id from stock_movements order by created_at desc limit 5"
# Projeção versionada
dc exec -T inventory-read-db psql -U inventory -d inventory_read \
  -c "select product_id, available_quantity, version from stock_projection order by updated_at desc limit 3"
~~~

Débito idempotente por `orderId`, chamando a rota interna **de dentro da rede
Docker** (substitua os IDs pelos do pedido 4.1). As duas chamadas retornam a
mesma resposta e o saldo não muda:

~~~bash
dc exec -T orders-service sh -c 'for i in 1 2; do wget -qO- \
  --header "X-Internal-Token: $INTERNAL_SERVICE_TOKEN" --header "Content-Type: application/json" \
  --post-data "{\"orderId\":\"<ORDER_ID>\",\"productId\":\"<PRODUCT_ID>\",\"quantity\":2}" \
  http://inventory-service:3000/internal/v1/inventory/debit; echo; done'
# Sem o token interno, a rota retorna 403:
dc exec -T orders-service wget -qO- http://products-service:3000/internal/v1/products/<PRODUCT_ID>
~~~

## 6. Gateway Nginx (pasta *5. Gateway Nginx*)

| # | Requisição | Esperado | O que destacar |
|---|---|---|---|
| 5.1 | `GET /internal/v1/products/:id` com `X-Internal-Token` | **404** `ROUTE_NOT_FOUND` | Rotas internas nunca são expostas; o token externo é descartado |
| 5.2 | `GET /api/v1/products/:id` | **405** `METHOD_NOT_ALLOWED`, header `Allow: PUT` | |
| 5.3 | `GET /api/v1/nao-existe` | **404** `ROUTE_NOT_FOUND` | Erro do gateway no mesmo formato JSON |
| 5.4 | `POST /api/v1/orders` com `X-Request-Id: apresentacao-001` sem JWT | **401**, header e `traceId` = `apresentacao-001` | Rastreabilidade ponta a ponta |

Logs correlacionados pelo request id:

~~~bash
dc logs nginx-gateway | grep apresentacao-001
# ... "POST /api/v1/orders HTTP/1.1" 401 ... request_id=apresentacao-001 upstream=172.28.0.x:3000
~~~

## 7. Resiliência (requisição 4.14)

~~~bash
dc stop inventory-service
~~~

| Requisição | Esperado | O que destacar |
|---|---|---|
| 4.14 `POST /api/v1/orders` (produto ativo) | **503** `DEPENDENCY_UNAVAILABLE`, "Serviço de Estoque indisponível" | Pedidos trata a falha da dependência (timeout 3 s) |
| 3.2 `GET /api/v1/inventory/:id` | **503** `SERVICE_UNAVAILABLE` | Erro gerado pelo próprio gateway |

~~~bash
dc logs orders-service | grep "Dependência indisponível"
# WARN [InventoryHttpClient] Dependência indisponível service=inventory-service reason=falha de conexão traceId=...
dc start inventory-service     # aguarde "healthy" em dc ps
~~~

Se após recriar um serviço o gateway continuar respondendo 503, reinicie-o
(`dc restart nginx-gateway`): o Nginx resolve os upstreams na inicialização.

## 8. Verificação automatizada

Com o sistema no ar:

~~~bash
bash scripts/demo-manual.sh     # 31 passos manuais conferidos (HTTP esperado)
npm run verify:flow             # E2E pelo gateway: X-Request-Id, 405, 404,
                                # cadastro → login → produto → estoque → projeções
                                # → pedido → conclusão idempotente → estoque 18
npm run verify:flow:inventory   # concorrência de débitos, idempotência, Outbox
npm run verify:swagger:products
npm run verify:swagger:auth
npm run verify:swagger:orders
npm run verify:swagger:inventory
~~~

Testes unitários com cobertura mínima de 50% (não exigem o sistema no ar,
exceto Estoque, que usa Docker para Testcontainers):

~~~bash
npm run test:products
npm run test:auth
npm run test:orders
npm run test:inventory   # mvn verify (JUnit + Testcontainers + JaCoCo)
~~~

## 9. Equivalentes em curl

~~~bash
B=http://localhost:8080
curl -s $B/api/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Maria Silva","email":"maria@example.com","password":"SenhaSegura123"}'
TOKEN=$(curl -s $B/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"maria@example.com","password":"SenhaSegura123"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
PRODUCT_ID=$(curl -s $B/api/v1/products -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Hambúrguer artesanal","description":"Com queijo","price":29.90,"active":true}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
curl -s $B/api/v1/inventory -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$PRODUCT_ID\",\"quantity\":20}"
ORDER_ID=$(curl -s $B/api/v1/orders -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$PRODUCT_ID\",\"quantity\":2}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
curl -s $B/api/v1/orders/$ORDER_ID -H "Authorization: Bearer $TOKEN"
curl -s -X POST $B/api/v1/orders/$ORDER_ID/complete -H "Authorization: Bearer $TOKEN"
curl -s $B/api/v1/inventory/$PRODUCT_ID -H "Authorization: Bearer $TOKEN"
~~~

## 10. Encerramento

~~~bash
npm run infra:down        # para os containers e mantém os volumes (dados)
# dc down --volumes       # apaga também os dados (somente em ambiente de teste)
~~~
