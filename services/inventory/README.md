# Estoque — Java com Spring Boot

Aplicação Java 21, Spring Boot 3.5.16 e Maven. Produtos continua em NestJS.
A migração preserva os contratos HTTP, os eventos RabbitMQ e as tabelas PostgreSQL.

## Por onde começar

Todas as classes ficam em `src/main/java/br/com/delivery/inventory/`.

| Pasta / classe | Responsabilidade |
|---|---|
| `InventoryApplication` | Inicia a aplicação Spring Boot |
| `domain/StockRules` | Quantidade válida, soma, saldo suficiente e repetição de pedidos |
| `domain/Stock` | Saldo de um produto |
| `domain/DebitResult` | Resposta original de um débito |
| `domain/StockEvent` | Evento enviado pelo RabbitMQ |
| `domain/StockException` | Erro de negócio com código e status |
| `application/usecase/AddStockUseCase` | Coordena a adição de estoque |
| `application/usecase/DebitStockUseCase` | Coordena o débito |
| `application/usecase/GetStockUseCase` | Consulta o saldo e trata ausência |
| `application/ports/` | Interfaces dos repositórios e do publicador |
| `presentation/InventoryController` | Recebe as chamadas públicas |
| `presentation/InternalInventoryController` | Recebe o débito interno |
| `presentation/dto/` | Dados de entrada e respostas HTTP |
| `infrastructure/persistence/` | SQL e transações de escrita/leitura |
| `infrastructure/messaging/` | Outbox, publicação e consumo de eventos |
| `infrastructure/auth/AuthenticationFilter` | Valida JWT e token interno |
| `infrastructure/config/` | Configura bancos, RabbitMQ e documentação |

Exemplo de adição: o controller recebe o JSON e chama `AddStockUseCase`.
O caso de uso valida a quantidade e chama a interface `StockWriteRepository`.
O Spring entrega a implementação `StockWriteJdbcRepository` pelo construtor.
Ela bloqueia o produto na transação, usa `StockRules.add` para calcular o saldo
e grava saldo, movimentação e evento da Outbox juntos.

O worker publica o evento. O consumidor grava a projeção no banco de leitura.
Por isso a consulta pode demorar um instante para refletir uma alteração.

## Comandos

Na raiz do repositório, com JDK 21 e Maven 3.9+:

```sh
mvn -f services/inventory/pom.xml test
mvn -f services/inventory/pom.xml verify
mvn -f services/inventory/pom.xml -DskipTests package
```

`verify` exige Docker para os testes PostgreSQL/Testcontainers. A cobertura
fica em `target/site/jacoco/index.html`. JaCoCo exige 50% de branches, métodos,
linhas e instruções (bytecode, não uma contagem de statements Java).

Para a aplicação completa, configure `.env` a partir de `.env.example` na raiz:

```sh
npm run infra:up
npm run verify:swagger:inventory
npm run verify:flow:inventory
```

O container executa Java, sem Node. O roteiro de fluxo usa um container auxiliar
Node pelo perfil `tools`, cria UUIDs novos e deve ser executado em desenvolvimento.

Para execução direta com `mvn spring-boot:run`, exporte as variáveis necessárias
no terminal. Maven/Spring não carrega automaticamente o `.env` do Compose.
Os hosts dos bancos devem ser acessíveis nesse ambiente; o Compose padrão não
publica portas dos bancos no host.

## API

- `POST /api/v1/inventory`: productId e quantity; JWT obrigatório.
- `GET /api/v1/inventory/{productId}`: consulta; JWT obrigatório.
- `POST /internal/v1/inventory/debit`: orderId, productId e quantity; token interno.
- `GET /health`: disponibilidade do processo.

Swagger: `/docs` e `/docs-json` internamente; pelo gateway,
`http://localhost:8080/inventory/docs`. `SWAGGER_ENABLED=true` habilita apenas
fora de produção. As rotas internas continuam bloqueadas no Nginx.

## Dados existentes

Flyway adota as tabelas da versão NestJS com baseline 0 e migração V1.
Os volumes, saldos, movimentos, eventos pendentes e projeções são preservados.
Não exclua volumes para atualizar; faça backup antes de migrar dados importantes.
O teste `InventoryIT.adoptsLegacyTablesWithoutDataLoss` verifica essa transição.

Referências: [Spring Boot](https://docs.spring.io/spring-boot/3.5/),
[Spring AMQP](https://docs.spring.io/spring-amqp/reference/),
[springdoc-openapi](https://springdoc.org/v2/).
