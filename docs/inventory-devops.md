# T2 — Delivery Inventory

Guia de entrega do microsserviço de Estoque, desenvolvido em Java 21 e Spring Boot.
Repositório definitivo: [guilhermeschr/trabalho-devops](https://github.com/guilhermeschr/trabalho-devops).
A aplicação permanece em `services/inventory`; os outros serviços têm pipelines próprios.

## Acessos

| Componente | Endereço |
|---|---|
| Workflow | [Inventory — GitHub Actions](https://github.com/guilhermeschr/trabalho-devops/actions/workflows/inventory.yml) |
| Sonar de entrega | [Delivery Inventory](https://sonarcloud.io/project/overview?id=guilhermeschr_inventory) |
| DEV | https://inventory-dev.onrender.com |
| Swagger DEV | https://inventory-dev.onrender.com/docs |
| HOMOL | https://inventory-homol.onrender.com |
| Imagens | https://hub.docker.com/r/d2gtrabalhos/trabalho-devops-inventory/tags |
| Prometheus local | http://localhost:9090/targets |
| Grafana local | http://localhost:3001/d/inventory-t2 |

Prometheus e Grafana dependem dos containers locais e da máquina ligada.
Seus endereços localhost não são URLs públicas para o professor.

## Fluxo exigido pelo trabalho

`feature/*` → PR para `develop` (DEV) → PR para `main` (HOMOL).

O workflow [inventory.yml](../.github/workflows/inventory.yml) executa:

1. Maven `verify`: build, testes unitários, integração PostgreSQL e cobertura JaCoCo.
2. Testes do script de implantação e análise Sonar com Quality Gate obrigatório.
3. Build da imagem Docker, dependente da qualidade aprovada.
4. Em pushes de develop/main, publicação no Docker Hub e deploy no ambiente correspondente.
5. Acompanhamento do deploy até `live` e validação dos endpoints públicos.

O filtro de caminhos inclui `services/inventory/**`, o workflow, seus scripts
e o monitoramento do Inventory. Uma alteração apenas no README da raiz não
aciona esse pipeline. Para demonstrar, altere `services/inventory/README.md`.
Features, PRs e execuções manuais validam sem publicar nem implantar.

Configuração de Variables, Secrets, Environments e Sonar:
[CI/CD do Inventory](inventory-cicd.md).

## Nomes e versão

O nome de apresentação no Sonar e no Maven é **Delivery Inventory**, no padrão
dos projetos Delivery Auth, Delivery Orders e Delivery Products.
O artifactId `inventory-service`, o workflow `Inventory`, as URLs Render,
os nomes dos bancos e o repositório da imagem permanecem compatíveis.

A versão está em `services/inventory/pom.xml`: `0.1.0`.
Use Semantic Versioning: PATCH para correções compatíveis, MINOR para novas
funcionalidades compatíveis e MAJOR para quebra de contrato.
Tags Docker incluem versão, ambiente e commit. O deploy usa digest imutável.
Detalhes: [Docker Hub](inventory-dockerhub.md).

## Rede, rotas e ambientes

Há um Web Service público Spring por ambiente, sem Nginx dedicado na cloud.
O Compose local mantém seu gateway e suas regras. `PORT` do Render tem
precedência sobre `INVENTORY_PORT`; o padrão local é 3000.

| Rota | Proteção |
|---|---|
| `POST /api/v1/inventory` | JWT |
| `GET /api/v1/inventory/{productId}` | JWT |
| `POST /internal/v1/inventory/debit` | `X-Internal-Token` |
| `/health`, `/actuator/health`, `/actuator/health/readiness` | Sem token; sem detalhes internos |
| `/actuator/prometheus` | Bearer `METRICS_TOKEN` |
| `/docs` e `/docs-json` | Habilitados em DEV e desabilitados em HOMOL |

Ser acessível na internet não elimina autenticação. A rota interna exige token,
mas não tem isolamento de rede HTTP no Render. Não há alteração de contrato.

DEV usa `APP_ENV=dev`, `NODE_ENV=development`, `SWAGGER_ENABLED=true`.
HOMOL usa `APP_ENV=homol`, `NODE_ENV=production`, `SWAGGER_ENABLED=false`
e `SPRING_PROFILES_ACTIVE=production`.

## Bancos e RabbitMQ

São quatro bancos lógicos: `inventory_dev_write`, `inventory_dev_read`,
`inventory_homol_write` e `inventory_homol_read`. A implantação existente usa
um servidor PostgreSQL e o mesmo usuário, conforme opção do responsável.
Os dados são separados por banco; as permissões desse usuário não isolam ambientes.
As migrações Flyway são executadas na inicialização, sem apagar dados existentes.
RabbitMQ separa DEV/HOMOL por vhost ou instância.

| Grupo | Variáveis do serviço Render |
|---|---|
| Escrita | `INVENTORY_WRITE_DB_HOST`, `INVENTORY_WRITE_DB_PORT`, `INVENTORY_WRITE_DB_NAME`, `INVENTORY_WRITE_DB_USER`, `INVENTORY_WRITE_DB_PASSWORD` |
| Leitura | `INVENTORY_READ_DB_HOST`, `INVENTORY_READ_DB_PORT`, `INVENTORY_READ_DB_NAME`, `INVENTORY_READ_DB_USER`, `INVENTORY_READ_DB_PASSWORD` |
| JDBC opcional | `INVENTORY_WRITE_URL`, `INVENTORY_READ_URL` |
| RabbitMQ | `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_INVENTORY_QUEUE` |
| Autenticação | `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, `METRICS_TOKEN` |

`*_DB_HOST` recebe somente o hostname. URLs JDBC completas podem incluir os
parâmetros TLS exigidos pelo provedor; mantenha usuário/senha separados da URL.
Use AMQPS no acesso externo ao RabbitMQ. JWT e token interno devem corresponder
aos serviços do mesmo ambiente; o token de métricas é separado.
As credenciais reais ficam no Render e nos GitHub Secrets, nunca no Git.

## Observabilidade

O Actuator/Micrometer produz métricas do Spring, HTTP, JVM, CPU e Hikari.
O Prometheus coleta `/actuator/prometheus` a cada 15 segundos, usando o token
de cada ambiente, e armazena séries temporais no seu volume Docker.
O Grafana consulta o Prometheus em `http://prometheus:9090` e exibe os gráficos.

Os sete painéis mostram coleta disponível, requisições por segundo, p95,
erros 5xx, memória JVM, CPU e conexões de banco. O label `environment`
separa DEV/HOMOL. `up` confirma a coleta, não a convergência CQRS.
Existem regras de alerta, mas não há entrega de notificações configurada.

Configuração e inicialização: [monitoring/inventory/README.md](../monitoring/inventory/README.md).
Não executar `docker compose down --volumes` para demonstrar o monitoramento.

## Evidências e pendências da entrega

Resultados confirmados no repositório original em 03/11/2026:

- [DEV aprovado — testes, Sonar, imagem e deploy](https://github.com/guilhermeschr/trabalho-devops/actions/runs/41761863828).
- [HOMOL aprovado — testes, Sonar, imagem e deploy](https://github.com/guilhermeschr/trabalho-devops/actions/runs/41761540008).
- Prometheus com os dois targets UP e Grafana com dados reais após os deploys.

Em 04/11/2026, a [alteração de README na feature](https://github.com/guilhermeschr/trabalho-devops/actions/runs/41822636424)
aprovou quality e image; deploy foi corretamente pulado.
Essas execuções usavam a organização Sonar anterior e não comprovam a migração.

Em 08/11/2026, Delivery Inventory foi criado no monorepo da organização
`guilhermeschr`. Antes de encerrar a migração, conferir análise inicial de main,
análise de develop e Quality Gate no novo projeto, sem ignorar o gate.
Atualize as evidências somente após verificar os resultados remotos.

Para a apresentação, confira novamente os serviços Render e ligue o
monitoramento local. Mostre commit/branch, jobs do Actions, análise Sonar,
imagem/digest, deploy Render e os gráficos. Não exponha valores de secrets.

Dependabot está em `.github/dependabot.yml`, incluindo Maven e Docker do Inventory.
A segurança das rotas é validada pelo CD: 401 sem JWT/métricas e 403 sem token
interno; Swagger deve ser 200 em DEV e 404 em HOMOL. O POST de teste não movimenta estoque.
