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

Projeto `guilhermeschr_auth` ("Delivery Auth") na organização OSS
`guilhermeschr`, vinculado ao repositório como monorepo. O plano OSS é
necessário: no plano Free comum a análise de `develop` falha com
"Organization is not allowed to access data from non main branches".
Análise automática desligada, `main` principal e `develop` como branch longa
(`(develop|main|(branch|release)-.*)`). A análise inicial da `main` foi feita
em 09/11/2026 pelo scanner local, com Quality Gate aprovado na segunda
execução (a primeira retorna `NONE`). O token é de um membro da organização,
com permissão de executar análise.
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
http://localhost:9094 e Grafana em http://localhost:3003.

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
| URL DEV | https://auth-dev-j1ar.onrender.com (`srv-dboso7ijnfac73fu86bg`) |
| URL HOMOL | https://auth-homol.onrender.com (`srv-dbosupc9v7es738a5ncg`) |
| Projeto Sonar | https://sonarcloud.io/dashboard?id=guilhermeschr_auth |
| Primeira release DEV | [auth-v0.2.0-dev.7](https://github.com/guilhermeschr/trabalho-devops/releases/tag/auth-v0.2.0-dev.7), digest `sha256:44ff3c1af4a06a504c77c4aba20dd48bbab3de14805a87d523707ba873ea2bf7` |
| Primeiro CD DEV | [run 42622882644](https://github.com/guilhermeschr/trabalho-devops/actions/runs/42622882644), deploy `dep-dbot4ue417fc739b3bsg` live e validado |
| Primeira release HOMOL | pendente (promoção `develop` → `main`) |

Provisionamento em 09/11/2026:

- Serviços criados por Existing Image com o digest acima, plano Free, região
  Virginia, health check `/health`; `autoDeploy=no` ajustado pela API.
- Bancos `auth_dev`/`auth_homol` com usuários próprios na instância PostgreSQL
  compartilhada do grupo (expira em 30/11/2026), `REVOKE CONNECT ... FROM
  PUBLIC` e TLS com validação de certificado verificado.
- A primeira análise Sonar de uma branch longa (`main` ou `develop`) retorna
  `NONE` e reprova o passo; a reexecução calcula o Quality Gate.
- Verificação manual: `/health` 200, versão com ambiente correto, `/metrics`
  401 sem token, Swagger 200 em DEV e 404 em HOMOL.
- Fluxo ponta a ponta direto nos serviços Render, em DEV e em HOMOL: cadastro
  e login no Auth, produto e estoque com o JWT emitido, pedido criado (Pedidos
  chama Produtos e Estoque com `X-Internal-Token`), consulta, conclusão
  idempotente e débito refletido na projeção de estoque (20 → 18).

- [x] Quality Gate aprovado em `develop` e `main`.
- [x] Imagem DEV publicada e implantada automaticamente.
- [ ] Imagem HOMOL publicada e implantada automaticamente.
- [x] Swagger 200 em DEV e 404 em HOMOL.
- [x] Prometheus com os dois targets UP e dashboard com tráfego real.

Monitoramento em 09/11/2026: Prometheus local (http://localhost:9094) com
`auth-dev` e `auth-homol` UP via HTTPS e Bearer `METRICS_TOKEN`; Grafana
(http://localhost:3003/d/auth-delivery) com o dashboard provisionado e o datasource
consultando os dois alvos. Tráfego gerado pelo fluxo cloud (3 execuções por
ambiente) e por requisições inválidas (4xx); as séries de requisições por
rota/status, latência p95 e `auth_build_info` (`0.2.0-dev.7`) aparecem nos dois
ambientes. A coleta mantém os serviços Free acordados e consome as horas do
workspace Render: suba o monitoramento só para evidências e apresentação.
