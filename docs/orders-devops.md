# DevOps de Pedidos

Estado: o código, o workflow, os scripts e o monitoramento estão preparados.
SonarCloud, Docker Hub, Render e Environments ainda precisam ser configurados;
a existência destes arquivos não significa que algo esteja provisionado.
Contratos: seção 23 da especificação.

Responsável: Giancarlo Roveda (Auth e Pedidos).

## Fluxo

1. Push ou PR em `feature/**` roda o job `quality`, sem publicar nada.
2. Merge em `develop` publica `X.Y.Z-dev.<run>` e implanta em DEV.
3. Merge em `main` publica `X.Y.Z` e implanta em HOMOL.

A versão base fica em `services/orders/package.json` e segue SemVer. Para uma
nova release estável, incremente essa versão em `develop` antes de promover
para `main`. Se a versão já tiver sido publicada com outro commit, o pipeline
é bloqueado.

## Configuração GitHub

Repositório: guilhermeschr/trabalho-devops. Workflow Orders.

| Tipo | Nome | Local |
|---|---|---|
| Secret | ORDERS_SONAR_TOKEN | Repositório |
| Variable | ORDERS_SONAR_ORGANIZATION | Repositório |
| Variable | ORDERS_SONAR_PROJECT_KEY | Repositório |
| Variable | ORDERS_DOCKERHUB_USERNAME | Repositório (dono do repositório `orders-service`) |
| Secret | ORDERS_DOCKERHUB_TOKEN | Repositório; token só de publicação |
| Variable | ORDERS_DEPLOY_ENABLED | Repositório; `true` só depois de preparar os ambientes |
| Secret | ORDERS_RENDER_API_KEY | Environment DEV/HOMOL |
| Variable | ORDERS_RENDER_SERVICE_ID | Environment DEV/HOMOL (`srv-...`) |
| Variable | ORDERS_APP_URL | Environment DEV/HOMOL; origem HTTPS |

Os Environments `DEV` (somente `develop`) e `HOMOL` (somente `main`) são
compartilhados com os demais serviços. Não altere as variáveis dos outros
serviços.

## SonarCloud

O projeto é "Delivery Orders", em organização do plano OSS, com análise
automática desligada, `main` como branch principal e `develop` como branch
longa. A configuração fica em `services/orders/sonar-project.properties`.

## Docker Hub

Repositório público `<ORDERS_DOCKERHUB_USERNAME>/orders-service`, com as tags
`<versão>` e `sha-<commit>-<versão>`. O CD sempre implanta pelo digest.

## Render

Crie `orders-dev` e `orders-homol` pela opção **Existing Image**
(`docker.io/<usuário>/orders-service:<versão>`), no plano gratuito, sem
conectar repositório nem branch e sem auto-deploy. Health check path:
`/health`.

| Variável | DEV | HOMOL |
|---|---|---|
| APP_ENV | `dev` | `homol` |
| NODE_ENV | `development` | `production` |
| SWAGGER_ENABLED | `true` | `false` |
| JWT_SECRET | igual ao de Auth, Produtos e Estoque DEV | igual ao dos serviços HOMOL |
| INTERNAL_SERVICE_TOKEN | igual ao de Produtos e Estoque DEV | igual ao de Produtos e Estoque HOMOL |
| METRICS_TOKEN | exclusivo | exclusivo |
| PRODUCTS_SERVICE_URL | `https://products-dev-4e3e.onrender.com` | `https://products-homol.onrender.com` |
| INVENTORY_SERVICE_URL | `https://inventory-dev.onrender.com` | `https://inventory-homol.onrender.com` |
| ORDERS_HTTP_TIMEOUT_MS | `10000` (cold start do plano gratuito) | `10000` |
| ORDERS_DB_HOST/PORT/NAME/USER/PASSWORD | banco `orders_dev` | banco `orders_homol` |
| ORDERS_DB_SSL | `true` | `true` |

O Render fornece `PORT`. As migrações rodam na inicialização. O serviço não
sobe em DEV/HOMOL se encontrar URLs HTTP, credenciais na URL ou valores
fictícios (`change-me*`, `orders`, `postgres`).

Antes de usar as URLs da tabela, confirme com os responsáveis de Produtos e
Estoque. No plano gratuito, serviços inativos demoram a acordar: um pedido
logo após um período parado pode receber 503 se o timeout for curto.

## Monitoramento

Veja [monitoring/orders/README.md](../monitoring/orders/README.md): Prometheus
em http://localhost:9093 e Grafana em http://localhost:3004. O alerta
`OrdersDependencyUnavailable` indica 503 de Produtos ou Estoque.

## Verificação local

~~~bash
npm run test:orders
npm run build:orders
python3 -m unittest discover -s scripts -p 'test_*nest*.py'
npm run infra:up
npm run verify:swagger:orders
npm run verify:flow
~~~

## Evidências

| Item | Link/valor |
|---|---|
| URL DEV | a preencher |
| URL HOMOL | a preencher |
| Projeto Sonar | a preencher |
| Primeira release DEV | a preencher |
| Primeira release HOMOL | a preencher |

- [ ] Quality Gate aprovado em `develop` e `main`.
- [ ] Imagem DEV publicada e implantada automaticamente.
- [ ] Imagem HOMOL publicada e implantada automaticamente.
- [ ] Pedido criado em DEV e HOMOL usando Produtos e Estoque cloud.
- [ ] Swagger 200 em DEV e 404 em HOMOL.
- [ ] Prometheus com os dois targets UP e dashboard com tráfego real.
