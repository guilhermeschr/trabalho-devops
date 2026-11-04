# CI/CD do Inventory no fork

O fork [DanielHoepers/trabalho-devops](https://github.com/DanielHoepers/trabalho-devops)
permite configurar o CI/CD sob administração da própria conta. O repositório
original continua em guilhermeschr/trabalho-devops. Somente arquivos do Inventory
e sua documentação/configuração DevOps pertencem a esta alteração.

## Fluxo

`feature/*` → PR para `develop` (DEV) → PR para `main` (HOMOL).

O workflow exclusivo `.github/workflows/inventory.yml` compila com Java 21,
executa Maven verify com JUnit/Testcontainers/JaCoCo, os testes do controle
de deploy, o Sonar com Quality Gate e o build Docker. Pushes em develop/main
publicam `docker.io/d2gtrabalhos/trabalho-devops-inventory` com tags SemVer,
ambiente e SHA. Labels OCI identificam repositório, commit e versão.

Features e PRs não publicam imagens nem implantam. O botão Run workflow valida
e constrói, mas o guard atual também impede publicação/deploy nesse evento.
Deploy exige push em develop/main, dependências aprovadas e a Variable de
repositório `INVENTORY_DEPLOY_ENABLED=true`.

## Configurações exclusivas do fork

GitHub Actions deve estar habilitado; forks nascem com workflows desabilitados.
Não copie segredos por commit nem tente recuperá-los do repositório original.

| Environment | Branch permitida | INVENTORY_RENDER_SERVICE_ID | INVENTORY_APP_URL |
|---|---|---|---|
| DEV | develop | srv-dbj27fh42hec73br5fh0 | https://inventory-dev.onrender.com |
| HOMOL | main | srv-dbj2k6rbc2fs73blum3g | https://inventory-homol.onrender.com |

Cada Environment guarda `INVENTORY_RENDER_API_KEY` como Secret, sem aprovação
manual obrigatória para que o CD seja automático. O fork reutiliza esses dois
serviços Inventory existentes no plano Free, mantendo bancos e mensageria.
Não habilitar um segundo pipeline de deploy concorrente no original ou Render.

Variables de repositório:

| Nome | Valor |
|---|---|
| INVENTORY_SONAR_ORGANIZATION | danielhoepers-devops |
| INVENTORY_SONAR_PROJECT_KEY | danielhoepers-devops_inventory-fork |
| INVENTORY_DOCKERHUB_USERNAME | d2gtrabalhos |
| INVENTORY_DEPLOY_ENABLED | false durante preparação; true somente após conferir as configurações |

O Secret de repositório `INVENTORY_SONAR_TOKEN` contém o token do novo projeto.
O Sonar usa o projeto público `inventory-service-fork` na organização OSS
existente, separado do projeto do original. Manter main como principal e
develop como branch longa. O token pessoal criado para o fork tem expiração:
consultar a data em SonarCloud → My account → Access tokens e renovar antes
do vencimento, atualizando somente o Secret. Nenhum token integra este documento.

## Publicação e deploy

O job publica no Docker Hub com a Variable `INVENTORY_DOCKERHUB_USERNAME`
e o Secret de repositório `INVENTORY_DOCKERHUB_TOKEN` (token com leitura/escrita,
sem exclusão). O GITHUB_TOKEN não autentica a publicação no Docker Hub.
O repositório de imagem é público; o Render pode baixar a imagem sem credencial
adicional de registro. A imagem copia somente POM, fontes e JAR; variáveis reais
ficam no Render. O Dockerfile e a aplicação não mudam com a troca de registro.
Veja [migração para Docker Hub](inventory-dockerhub.md).

Antes do primeiro deploy pelo fork, ajustar Image → Source dos dois serviços
Render para uma tag já publicada em `docker.io/d2gtrabalhos/trabalho-devops-inventory`.
A API de deploy exige o mesmo host/repositório/nome de imagem configurados no
serviço. A troca da origem pela interface também inicia uma implantação.

O job deploy passa o digest imutável à API Render, acompanha o ID específico
do deploy até live e verifica prontidão, JWT, token interno, proteção de métricas
e Swagger. Ele não movimenta estoque e não faz rollback automático.
`/docs` é verificado com `Accept: text/html`; `/docs-json` com
`Accept: application/json`. Os testes impedem solicitar JSON à interface HTML.

## Validação e evidências

Na preparação local de 01/11/2026, Maven verify passou com 23 testes unitários,
10 de integração PostgreSQL e todos os limites JaCoCo, sem testes ignorados.
Os 9 testes Python de controle de deploy também passaram.

Registrar aqui as execuções remotas somente após conferir seus resultados:

- [ ] Análise principal do novo Sonar aprovada.
- [ ] CI e imagem DEV publicados no fork.
- [ ] Deploy DEV automático aprovado e serviço live.
- [ ] CI e imagem HOMOL publicados no fork.
- [ ] Deploy HOMOL automático aprovado e serviço live.
- [ ] Targets Prometheus e dashboard confirmados após os deploys.

Na primeira análise, o Sonar pode retornar NONE porque o Quality Gate ainda
não foi calculado. Confirmar a causa e reexecutar a análise; não ignorar gate.

## Pull Request futuro para o original

Depois da validação, enviar somente as alterações dos arquivos por PR. O dono
do original precisa cadastrar seus próprios Environments, Variables e Secrets.
Essas configurações não são transferidas pelo PR. O original precisa definir
seu próprio usuário Docker e token e alinhar a origem da imagem no Render;
o nome do repositório compõe o nome da imagem.
Mantenha o CD ativo em somente um repositório para esses serviços até combinar
a migração, evitando que original e fork substituam o mesmo serviço em paralelo.
