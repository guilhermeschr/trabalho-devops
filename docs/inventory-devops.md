# T2 — DevOps do Estoque

O estoque permanece em `services/inventory` neste monorepo. O workflow é
`.github/workflows/inventory.yml`; os demais microsserviços não foram alterados.

## Estado da entrega

Os arquivos de CI/CD e monitoramento são preparação local. Só marque as etapas
abaixo após guardar a evidência correspondente. Nenhum serviço remoto, token,
URL ou aprovação do Sonar é presumido por este documento.

- [x] Actuator, readiness e Prometheus protegidos por token próprio.
- [x] Testes automatizados, PostgreSQL/Testcontainers e JaCoCo no Maven.
- [x] Workflow, Dockerfiles e script de CD escritos.
- [x] Prometheus, alertas e dashboard Grafana versionados.
- [x] Projeto Sonar OSS configurado; análise e Quality Gate da feature aprovados remotamente.
- [x] Principal do Sonar alinhada a main; develop incluída no padrão de branches longas.
- [ ] Análise inicial de main/develop validada.
- [ ] Imagens publicadas no GHCR pelo workflow.
- [ ] DEV e HOMOL provisionados e deploys aprovados remotamente.
- [ ] URLs DEV/HOMOL e dashboard preenchidos com endereços reais.
- [ ] Prometheus coletando dados reais e Grafana exibindo tráfego.
- [ ] Execuções do pipeline e evidências anexadas à entrega.

## Validação da alteração de 2026-10-28

`mvn -B -f services/inventory/pom.xml verify` com Java 21 e Docker passou:
23 testes unitários e 10 de integração, nenhum ignorado. Os testes de integração
confirmam diretamente no Spring o débito com token, rejeição sem token e os
contratos existentes. JaCoCo: 97,06% instruções, 96,08% branches, 96,58% linhas
e 97,00% métodos, acima dos limiares de 50%.
Os 9 testes do controle de deploy passaram, incluindo a implantação de apenas
um serviço e a rejeição de débito público sem token (403). Os testes rejeitam
404 nessa rota, pois ela deve estar acessível diretamente. Não houve validação
em URL Render, push ou deploy nesta alteração.

## Git Flow e versão

`feature/*` → PR para `develop` (DEV) → PR para `main` (HOMOL).
O workflow executa build/testes/cobertura e Sonar; o build da imagem depende
do Quality Gate. PRs e features nunca publicam nem implantam.
PRs de forks, incluindo Dependabot sem secrets próprios, executam os testes
sem Sonar. Essa execução não comprova análise Sonar: o push posterior em
`develop`/`main` exige o gate antes de publicar/deployar. Nunca use
`pull_request_target` para executar código de terceiros com secrets.
`workflow_dispatch` valida e constrói sem publicar ou implantar.

A versão oficial está em `services/inventory/pom.xml`, inicialmente `0.1.0`.
Incremente PATCH para correção compatível, MINOR para funcionalidade compatível
e MAJOR para quebra de contrato; registre a mudança no README/especificação.
Tags das imagens usam `X.Y.Z-dev-<sha>` em DEV e `X.Y.Z-<sha>` em HOMOL.
O SHA distingue builds da mesma versão. Não se usa `latest` no CD: a referência
implantada é sempre `imagem@sha256:...`. Tags Git `inventory-vX.Y.Z` podem ser
criadas na main após a aprovação da versão, somente por solicitação do usuário.
Os artefatos Maven mantêm a versão do POM; a tag Docker também identifica o commit.

## SonarCloud

Crie um projeto exclusivo para Estoque, associado ao mesmo repositório.
Desative a análise automática do Sonar: a análise será por Maven/CI, com o XML
do JaCoCo. Configure `main` como principal e `develop` como branch longa
(padrão de branches longas incluindo `develop`). Inicialize a análise da main
antes de analisar branches/PRs. Configure a proteção de main/develop para exigir
o check Inventory e o Quality Gate; não autorize bypass silencioso do gate.

O plano Free comum só analisa a branch principal. Para este repositório
público, a opção gratuita é uma organização no plano OSS, que permite análise
de branches e PRs. A organização OSS criada para o estoque é
`danielhoepers-devops`, e o projeto público é `danielhoepers-devops_inventory`.
O workflow exige um plano com suporte às branches analisadas; não ignora um
Quality Gate reprovado. A análise remota da feature foi aprovada; main/develop ainda precisam de validação.

Configuração no repositório GitHub:

| Tipo | Nome |
|---|---|
| Secret | `INVENTORY_SONAR_TOKEN` |
| Variable ou Secret | `INVENTORY_SONAR_ORGANIZATION` |
| Variable ou Secret | `INVENTORY_SONAR_PROJECT_KEY` |

Os identificadores podem ser cadastrados em Variables ou Secrets. O workflow
prefere Variables quando preenchidas e usa Secrets como alternativa. O token
é aceito somente em Secrets. Nenhum valor é gravado no código ou impresso
pelo script de validação.

A primeira execução remota aprovou os testes e a cobertura, mas parou antes
do scanner porque os identificadores não estavam em Variables. Depois, o
usuário cadastrou os identificadores em Secrets; o workflow foi adaptado para
ler essa configuração sem exigir novo cadastro.

Fontes: [plano OSS](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans#oss-plan),
[limitações de branches do SonarCloud](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/branch-analysis/branch-analysis).

## Validação local

Em 2026-10-25, no Mac com Java 21 e Docker, `mvn -B -f
services/inventory/pom.xml verify` terminou com BUILD SUCCESS: 23 testes
unitários e 10 de integração, nenhum ignorado. JaCoCo: 97,06% instruções,
96,08% branches, 96,58% linhas e 97,00% métodos (limiares de 50%).
Oito testes do script de deploy passaram. Actionlint validou o workflow;
Promtool validou a configuração e as duas regras com tokens fictícios em
arquivos temporários. Targets reais ainda não existem.
Os builds Docker de Spring e gateway passaram no Mac (ARM64). O workflow
configura o build de publicação para Linux amd64, ainda sem execução remota.
Nginx validou a configuração e bloqueou caminhos
internos (inclusive com ponto e vírgula) e `/actuator/env` em um container
local. Esse teste verifica o gateway; não comprova isolamento no Render.

No Mac, selecione Java 21 antes de usar Maven:

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
export PATH="$JAVA_HOME/bin:$PATH"
mvn -B -f services/inventory/pom.xml verify
```

## Validação remota da feature

Em 2026-10-25, a [execução Inventory 40221732500](https://github.com/guilhermeschr/trabalho-devops/actions/runs/40221732500)
terminou com sucesso no commit `69bc788` da `feature/inventory-devops`.
Passaram 23 testes unitários, 10 de integração, os limiares JaCoCo, os testes
do script de deploy, o Quality Gate do Sonar e os builds Docker Spring/gateway.
A publicação no GHCR e o deploy foram pulados pela regra da feature.

Em 2026-10-26, a principal do Sonar foi alinhada a `main` e o padrão longo
foi configurado como `^(develop|(branch|release)-.*)$`. A segunda tentativa
da mesma execução também passou em testes, cobertura, Quality Gate e builds
Docker, sem o aviso de referência `master` ausente. A publicação das imagens
e o deploy permaneceram pulados. Main/develop ainda não têm análise inicial;
o gate da feature não substitui essa validação posterior.

### Hospedagem direta do Inventory

Em 2026-10-28, foi aprovado publicar somente o Inventory como Web Service
público no Render, sem Nginx dedicado, preservando a autenticação. O pipeline
passa a construir e implantar apenas a imagem Spring. O Compose local e o
Nginx compartilhado permanecem iguais, assim como todos os outros serviços.
A alteração foi preparada localmente; não representa provisionamento ou deploy.
Bancos CQRS e RabbitMQ continuam necessários e seu provedor ainda depende da
escolha do grupo. Não há contratação de recursos nesta alteração.

## GHCR

Habilite GitHub Actions e permissão de escrita em Packages para o workflow.
`GITHUB_TOKEN` é emitido automaticamente pelo GitHub; não crie um token manual
para publicar no CI. A imagem Linux amd64 usa contexto Docker da raiz.

Imagens resultantes neste repositório:

- `ghcr.io/guilhermeschr/trabalho-devops-inventory`

Por padrão o pacote pode ser privado. Para o Render conseguir baixá-lo,
configure uma credencial do registro com `read:packages`, ou torne o pacote
público intencionalmente. Nunca grave essa credencial no repositório.

## Rede e serviços no Render

Para cada ambiente, use **um Web Service público Spring**, sem gateway dedicado:

| Ambiente | Web Service |
|---|---|
| DEV | `inventory-dev` |
| HOMOL | `inventory-homol` |

O CD existente usa serviço de imagem existente (image-backed), com a imagem
GHCR do Inventory. O GitHub aprova e publica; o script solicita o digest
aprovado pela API Render. Um primeiro build aprovado no GHCR é necessário.
Não habilite deploy automático de branches no Render em paralelo ao CD.
Selecione apenas uma opção gratuita disponível no painel antes de provisionar.

Spring escuta em `0.0.0.0` na `PORT` do ambiente (ou INVENTORY_PORT, padrão 3000).
Use `/actuator/health/readiness` no health check e a origem HTTPS do próprio
Web Service em `INVENTORY_APP_URL`. Não existem `INVENTORY_PRIVATE_HOST`,
`INVENTORY_PRIVATE_PORT` ou serviço Nginx nessa configuração.

| Rota direta | Proteção |
|---|---|
| `POST /api/v1/inventory` | JWT |
| `GET /api/v1/inventory/{productId}` | JWT |
| `POST /internal/v1/inventory/debit` | `X-Internal-Token` (403 sem token válido) |
| `GET /health`, `/actuator/health` e `/actuator/health/readiness` | Sem token; sem detalhes dos bancos |
| `GET /actuator/prometheus` | Bearer `METRICS_TOKEN` |
| `/docs`, `/docs-json` e recursos Swagger | Habilitados apenas fora de produção |

A publicação direta mantém os caminhos e filtros existentes do Spring. O
prefixo `/internal/` continua por compatibilidade; essa rota agora é alcançável
pela internet e sua autorização depende do token, sem isolamento de rede HTTP.
Pedidos poderá apontar `INVENTORY_SERVICE_URL` para a origem HTTPS do Inventory
e enviar o token correspondente. Essa alteração cabe ao responsável de Pedidos;
nenhum arquivo desse serviço foi modificado.

## Bancos, RabbitMQ e configuração do Spring

Crie quatro bancos lógicos: `inventory_dev_write`, `inventory_dev_read`,
`inventory_homol_write` e `inventory_homol_read`. Podem compartilhar servidor,
mas use credenciais e permissões isoladas por ambiente. Configure backups.
Use os parâmetros reais do provedor; a aplicação executa as migrações Flyway.
Para provedores que exigem parâmetros JDBC adicionais, sobrescreva
`INVENTORY_WRITE_URL` e `INVENTORY_READ_URL` com URLs JDBC completas (por exemplo,
`jdbc:postgresql://<host>:5432/<database>?sslmode=require`), sem senha na URL.
Essas variáveis sobrescrevem `inventory.write.url`/`inventory.read.url` pelo
mapeamento de ambiente do Spring.

Configure cada serviço Spring com seus próprios valores:

| Grupo | Variáveis |
|---|---|
| Escrita | `INVENTORY_WRITE_DB_HOST`, `INVENTORY_WRITE_DB_PORT`, `INVENTORY_WRITE_DB_NAME`, `INVENTORY_WRITE_DB_USER`, `INVENTORY_WRITE_DB_PASSWORD` |
| Leitura | `INVENTORY_READ_DB_HOST`, `INVENTORY_READ_DB_PORT`, `INVENTORY_READ_DB_NAME`, `INVENTORY_READ_DB_USER`, `INVENTORY_READ_DB_PASSWORD` |
| RabbitMQ | `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_INVENTORY_QUEUE` |
| Autenticação | `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, `METRICS_TOKEN` |
| DEV | `APP_ENV=dev`, `SWAGGER_ENABLED=true`, `NODE_ENV=development` |
| HOMOL | `APP_ENV=homol`, `SWAGGER_ENABLED=false`, `NODE_ENV=production`, `SPRING_PROFILES_ACTIVE=production` |

Use dois vhosts e usuários RabbitMQ separados, um por ambiente; a URL deve
incluir o vhost corretamente escapado. Restrinja permissões ao exchange e à
fila do estoque (ver seção 7.4 da especificação). Prefira `amqps://` nas conexões
externas. JWT e token interno devem corresponder aos serviços do mesmo ambiente;
METRICS_TOKEN é independente, forte e diferente nos dois ambientes.

## GitHub Environments e CD

Crie Environments `DEV` e `HOMOL`, sem aprovação manual obrigatória se o T2
exigir deploy automático. Restrinja DEV a develop e HOMOL a main. Configure em
cada um, sem sobrescrever valores de outros serviços:

| Tipo | Nome | Conteúdo |
|---|---|---|
| Secret | `INVENTORY_RENDER_API_KEY` | API key Render com acesso aos serviços |
| Variable | `INVENTORY_RENDER_SERVICE_ID` | ID `srv-...` do Web Service Spring público |
| Variable | `INVENTORY_APP_URL` | Origem HTTPS pública do Spring, sem caminho |

A API key é necessária para consultar o **deploy específico** até `live`.
Um deploy hook sozinho apenas confirma aceite; por isso `RENDER_DEPLOY_HOOK`
não é usado nesta implementação. O script implanta somente Spring e aguarda
`live`. Finalmente exige readiness UP, 401 sem JWT nas rotas de negócio,
401 sem token nas métricas, 403 no POST de débito sem token interno e
Swagger 200 em DEV/404 em HOMOL. O POST de verificação usa corpo vazio e
nenhuma credencial, sem movimentar estoque. Falha ou timeout falham o job.
O script não efetua rollback automático. Se necessário, escolha um digest
anterior aprovado e implante pelo painel; não apague bancos/volumes.

## Prometheus e Grafana

Siga [monitoring/inventory/README.md](../monitoring/inventory/README.md).
A configuração é adicional ao Compose do monorepo e não modifica outros serviços.
O dashboard usa environment para separar DEV/HOMOL e exibe disponibilidade da
coleta, RPS, latência p95, erros 5xx, memória JVM, CPU e conexões por banco.
A saúde de negócio e a convergência CQRS continuam exigindo testes de fluxo;
o painel `up` indica sucesso da coleta, não disponibilidade completa do domínio.
Alertas estão em `alerts.yml`; entrega de notificações exige Alertmanager ou
regras de notificação no Grafana, ainda não configurados.

## Evidências a entregar

| Evidência | Valor a registrar após validação |
|---|---|
| Repositório | https://github.com/guilhermeschr/trabalho-devops |
| Workflow e Quality Gate | URL da execução e análise por ambiente |
| DEV público | Pendente — URL real do Spring |
| HOMOL público | Pendente — URL real do Spring |
| Imagens | Digest do Spring de cada deploy |
| Prometheus | Targets dos dois ambientes UP |
| Grafana | URL acessível ao avaliador e captura com dados reais |
| Git Flow / SemVer | PRs feature → develop → main, versão e commit entregues |

Não coloque tokens, senhas ou links de deploy com chaves nas evidências.
