# CI/CD — Delivery Inventory

Repositório de entrega: [guilhermeschr/trabalho-devops](https://github.com/guilhermeschr/trabalho-devops).
Workflow: [Inventory](../.github/workflows/inventory.yml).
Somente o estoque é compilado, analisado e implantado por esse workflow.

## Fluxo

1. Crie `feature/<descricao>` a partir de `develop`.
2. Um push em caminhos do Inventory executa testes, cobertura, Sonar e build Docker.
3. O PR para `develop` valida a alteração. O merge dispara publicação e deploy DEV.
4. O PR de `develop` para `main` valida a promoção. O merge dispara publicação e deploy HOMOL.
5. O deploy exige qualidade aprovada, digest da imagem e `INVENTORY_DEPLOY_ENABLED=true`.

Features, PRs e `workflow_dispatch` não publicam nem implantam.
PRs externos e Dependabot não recebem os secrets de análise; testes aprovados
nesses casos não comprovam execução do Sonar. Não usar `pull_request_target`
para executar código de terceiros com secrets.

## Configuração do GitHub

As Variables abaixo pertencem ao repositório original:

| Variable | Valor |
|---|---|
| `INVENTORY_SONAR_ORGANIZATION` | `guilhermeschr` |
| `INVENTORY_SONAR_PROJECT_KEY` | `guilhermeschr_inventory` |
| `INVENTORY_DOCKERHUB_USERNAME` | `d2gtrabalhos` |
| `INVENTORY_DEPLOY_ENABLED` | `true` |

O workflow também aceita os identificadores Sonar em Secrets como alternativa;
Variables preenchidas têm precedência. Os valores de entrega devem ser
ativados somente com o novo projeto e suas permissões prontos.

Secrets do repositório: `INVENTORY_SONAR_TOKEN`, `INVENTORY_DOCKERHUB_TOKEN`
e `INVENTORY_RENDER_API_KEY`. Não copiar valores para arquivos versionados.
A chave Render existente é compartilhada pelos dois ambientes por herança do
Secret do repositório. Não é necessário duplicá-la nos Environments.

| Environment | Branch | `INVENTORY_RENDER_SERVICE_ID` | `INVENTORY_APP_URL` |
|---|---|---|---|
| DEV | develop | srv-dbj27fh42hec73br5fh0 | https://inventory-dev.onrender.com |
| HOMOL | main | srv-dbj2k6rbc2fs73blum3g | https://inventory-homol.onrender.com |

Esses IDs e URLs são Variables dos respectivos Environments.
O CD deve ter apenas um controlador ativo para os mesmos serviços Render.

## Sonar

Nome: **Delivery Inventory**. Organização: `guilhermeschr`.
Chave: `guilhermeschr_inventory`. Repositório vinculado: `guilhermeschr/trabalho-devops`.
O projeto é separado de Delivery Auth, Delivery Orders e Delivery Products.

A análise Maven usa `services/inventory/pom.xml`, Java 21 e o relatório
`target/site/jacoco/jacoco.xml`. Aguardar o Quality Gate é obrigatório.
Use `main` como principal e `develop` como branch longa. A análise deve vir
do CI, não de uma análise automática concorrente do monorepo inteiro.
O token precisa permitir análise no novo projeto; não revogue o token do CI
antes de validar seu substituto ou sua permissão atual.

## Imagem e deploy

Imagem: `docker.io/d2gtrabalhos/trabalho-devops-inventory`.
O nome técnico é preservado para manter a origem já configurada no Render.
A alteração do nome exibido no Sonar/Maven não exige trocar essa imagem.
Tags: `X.Y.Z-dev-<sha>` e `X.Y.Z-homol-<sha>`; deploy sempre por digest imutável.

O script `scripts/deploy-inventory.py` solicita a implantação pela API Render,
acompanha o deploy específico até `live` e valida readiness, JWT, token interno,
métricas e Swagger. Falha ou timeout reprova o job. O teste não movimenta estoque.
Swagger deve responder 200 em DEV e 404 em HOMOL.

## Como demonstrar

Abra Actions → Inventory e selecione uma execução da branch desejada.
Confira `quality` → `image` → `deploy`, depois o deploy correspondente no Render.
No Sonar, mostre a branch e o Quality Gate do mesmo commit.
No Prometheus, mostre os dois targets UP; no Grafana, selecione DEV/HOMOL.
As execuções manuais não demonstram CD porque o deploy é pulado nesse evento.

Veja [guia de entrega](inventory-devops.md) e [monitoramento](../monitoring/inventory/README.md).
