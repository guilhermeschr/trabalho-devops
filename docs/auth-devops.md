# DevOps de Auth

Estado: código, workflow, scripts e monitoramento preparados. SonarCloud,
Docker Hub, Render e Environments ainda precisam ser configurados; nada está
provisionado só porque estes arquivos existem. Contratos: seção 22 da
especificação.

Responsável: Giancarlo Roveda (Auth e Pedidos).

## Fluxo

1. Push ou PR em `feature/**` roda o job `quality` sem publicar.
2. Merge em `develop` publica `X.Y.Z-dev.<run>` e implanta em DEV.
3. Merge em `main` publica `X.Y.Z` e implanta em HOMOL.

A versão base fica em `services/auth/package.json` (SemVer). Para uma nova
release estável, incremente essa versão em `develop` antes de promover para
`main`. Uma versão já publicada com outro commit bloqueia o pipeline.

## Configuração GitHub

Repositório: guilhermeschr/trabalho-devops. Workflow Auth.

| Tipo | Nome | Local |
|---|---|---|
| Secret | AUTH_SONAR_TOKEN | Repositório |
| Variable | AUTH_SONAR_ORGANIZATION | Repositório |
| Variable | AUTH_SONAR_PROJECT_KEY | Repositório |
| Variable | AUTH_DOCKERHUB_USERNAME | Repositório (dono do repositório `auth-service`) |
| Secret | AUTH_DOCKERHUB_TOKEN | Repositório; token só de publicação |
| Variable | AUTH_DEPLOY_ENABLED | Repositório; `true` só após preparar os ambientes |
| Secret | AUTH_RENDER_API_KEY | Environment DEV/HOMOL |
| Variable | AUTH_RENDER_SERVICE_ID | Environment DEV/HOMOL (`srv-...`) |
| Variable | AUTH_APP_URL | Environment DEV/HOMOL; origem HTTPS |

Os Environments `DEV` e `HOMOL` já existem para Produtos e Estoque: DEV aceita
somente `develop` e HOMOL somente `main`, sem aprovação manual. Não alterar
variáveis dos outros serviços.

## SonarCloud

Projeto próprio "Delivery Auth" em organização no plano OSS (branches),
análise automática desligada, `main` principal e `develop` como branch longa.
A configuração do scanner está em `services/auth/sonar-project.properties`
(LCOV em `coverage/lcov.info`).

## Docker Hub

Repositório público `<AUTH_DOCKERHUB_USERNAME>/auth-service`. Tags:
`<versão>` e `sha-<commit>-<versão>`; o CD sempre usa o digest.

## Render

Criar `auth-dev` e `auth-homol` por **Existing Image**
(`docker.io/<usuário>/auth-service:<versão>`), plano gratuito, sem conectar
repositório nem branch e sem auto-deploy. Health check path: `/health`.

| Variável | DEV | HOMOL |
|---|---|---|
| APP_ENV | `dev` | `homol` |
| NODE_ENV | `development` | `production` |
| SWAGGER_ENABLED | `true` | `false` |
| JWT_SECRET | igual ao de Produtos, Estoque e Pedidos DEV | igual ao dos serviços HOMOL |
| JWT_EXPIRES_IN | `3600` | `3600` |
| METRICS_TOKEN | exclusivo | exclusivo |
| AUTH_DB_HOST/PORT/NAME/USER/PASSWORD | banco `auth_dev` | banco `auth_homol` |
| AUTH_DB_SSL | `true` | `true` |

O Render fornece `PORT`. As migrações rodam na inicialização. Valores
fictícios (`change-me*`, `auth`, `postgres`) impedem o startup em DEV/HOMOL.

## Monitoramento

Ver [monitoring/auth/README.md](../monitoring/auth/README.md): Prometheus em
http://localhost:9092 e Grafana em http://localhost:3003.

## Verificação local

~~~bash
npm run test:auth
npm run build:auth
python3 -m unittest discover -s scripts -p 'test_*nest*.py'
npm run infra:up
npm run verify:swagger:auth
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
- [ ] Swagger 200 em DEV e 404 em HOMOL.
- [ ] Prometheus com os dois targets UP e dashboard com tráfego real.
