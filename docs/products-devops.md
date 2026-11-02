# DevOps de Produtos

Estado: implementação local em validação; serviços externos só serão marcados
como concluídos após suas evidências. O Inventory do Daniel é preservado.

## Configuração GitHub

Repositório: guilhermeschr/trabalho-devops. Workflow Products.

| Tipo | Nome | Local |
|---|---|---|
| Secret | PRODUCTS_SONAR_TOKEN | Repositório |
| Variable | PRODUCTS_SONAR_ORGANIZATION | Repositório |
| Variable | PRODUCTS_SONAR_PROJECT_KEY | Repositório |
| Variable | PRODUCTS_DOCKERHUB_USERNAME | Repositório: d2gtrabalhos |
| Secret | PRODUCTS_DOCKERHUB_TOKEN | Repositório: publicação apenas |
| Variable | PRODUCTS_DEPLOY_ENABLED | Repositório; true só após preparar ambientes |
| Secret | PRODUCTS_RENDER_API_KEY | Environment DEV/HOMOL |
| Variable | PRODUCTS_RENDER_SERVICE_ID | Environment DEV/HOMOL |
| Variable | PRODUCTS_APP_URL | Environment DEV/HOMOL; origem HTTPS |

DEV restringe develop; HOMOL restringe main. Para deploy automático do T2,
não exigir aprovação manual em cada execução. Não alterar variáveis Inventory.
Não executar pull_request_target com código não confiável. Configurar proteção
de branches com os checks reais após a primeira execução; não usar bypass.

## SonarQube Cloud

Organização OSS `guilhermeschr` e projeto `guilhermeschr_products` (Delivery Products)
criados pelo Safari em 02/11/2026. Usar projeto próprio,
main principal, develop longa, análise automática desligada e análise CI com
LCOV. Plano Free comum não substitui suporte OSS a branches. Não iniciar trial.
Inicializar main antes das demais análises; configurar referências do Sonar sem
publicar/deployar uma main incompleta. Identificadores públicos em Variables,
token em Secrets; não documentar seu valor.

Docker Hub: repositório público `d2gtrabalhos/products-service` criado em 02/11/2026;
primeira imagem publicada: `0.2.0-dev.3`, conforme as evidências abaixo.

## Render e dependências

Criar products-dev e products-homol, imagem pública
`docker.io/d2gtrabalhos/products-service`, plano gratuito. Runtime recebe PORT.
Selecionar **Existing Image** na criação dos dois serviços. Não conectar o
repositório GitHub nem escolher branch no Render. Não usar On Commit ou After
CI Checks Pass e não cadastrar automação de registry/deploy hook paralela.

O fluxo de atualização autorizado é:

1. Push/merge em develop ou main aciona GitHub Actions.
2. Testes e Sonar Quality Gate aprovam a alteração.
3. O pipeline publica a imagem da release no Docker Hub e obtém seu digest.
4. O job de CD chama a API Render com `imageUrl` igual à imagem `@sha256:<digest>`.
5. O CD aguarda o deploy específico e confere versão, commit e contratos HTTP.

Alterar o repositório ou publicar uma tag não deve atualizar o Render fora
desse fluxo. O primeiro deploy de provisionamento e rollback manual também
usam digest aprovado. Esta configuração ainda precisa ser verificada nos
serviços reais de Produtos antes de habilitar PRODUCTS_DEPLOY_ENABLED.

A documentação oficial distingue serviços image-backed dos conectados ao Git
e confirma que imagens novas em uma tag não provocam redeploy automático:
[Deploy a Prebuilt Docker Image](https://render.com/docs/deploying-an-image).

Pré-condição: confirmar capacidade gratuita dos provedores existentes para
products_dev_write, products_dev_read, products_homol_write,
products_homol_read e mensageria própria por ambiente. Não usar bancos do
Inventory. Se não houver capacidade/permissão gratuita, registrar bloqueio
antes de criar recursos. Não contratar plano pago.

No CloudAMQP gratuito, não é possível administrar usuários ou criar vhosts
adicionais. A tentativa com as credenciais existentes retornou 403 em DEV e
401 em HOMOL; nenhum vhost de Produtos foi criado. Provisionar duas instâncias
gratuitas exclusivas de Produtos (uma por ambiente), cada uma com seu usuário
e vhost fornecidos pelo provedor. Não compartilhar credenciais ou filas do
Inventory e não aumentar o plano para contornar essa limitação.
[Limites oficiais do CloudAMQP](https://www.cloudamqp.com/docs/faq/).
Duas instâncias próprias Little Lemur foram criadas na conta d2gtrabalhos,
em Northern Virginia: products-dev e products-homol. AMQPS, publicação e consumo
foram validados em ambas. A chave API Render própria do CD está no GitHub.

Variáveis de runtime: APP_ENV, NODE_ENV, SWAGGER_ENABLED, JWT_SECRET,
INTERNAL_SERVICE_TOKEN, METRICS_TOKEN, PRODUCTS_DB_SSL,
PRODUCTS_{WRITE,READ}_DB_{HOST,PORT,NAME,USER,PASSWORD}, RABBITMQ_URL,
RABBITMQ_EXCHANGE e RABBITMQ_PRODUCTS_QUEUE. Use PostgreSQL TLS validado e
AMQPS externos. Tokens internos/JWT devem corresponder aos serviços do mesmo
ambiente; métricas têm token independente. Health check /health é liveness;
valide migrações, broker e convergência CQRS também antes de aprovar a entrega.

DEV: APP_ENV=dev, NODE_ENV=development, SWAGGER_ENABLED=true.
HOMOL: APP_ENV=homol, NODE_ENV=production, SWAGGER_ENABLED=false.

## Releases e promoção

Versão oficial em services/products/package.json e package-lock.json.
0.2.0-dev.<run_number> em develop, 0.2.0 em main. Git tags products-v<versão>.
Publicar release só após qualidade; retentativas reaproveitam digest e não
sobrescrevem versão existente de outro commit. Incremente versão antes de uma
nova entrega estável. Não usar latest. Consulte GET /api/v1/products/version.

Após DEV aprovado, promover develop → main/HOMOL. Depois, numa nova feature,
incrementar somente versão para 0.2.1 e integrar em develop. HOMOL permanece
0.2.0 enquanto DEV publica 0.2.1-dev.<build>.

Rollback: escolher digest anterior aprovado e implantar no serviço correto;
verificar versão e contratos. Não apagar bancos, migrações ou volumes.

## Validação e evidências

Executar testes Produtos, tipagem, build, testes Python de release/deploy,
Swagger UI/JSON, Docker build e fluxo Compose. Monitoramento segue
../monitoring/products/README.md. Guardar URLs dos pipelines e Sonar, URLs
DEV/HOMOL, tags Git, digests, respostas de versão e dashboard com dados reais.
Não registrar tokens, URLs com credenciais nem chaves de deploy.

- [ ] Projeto Sonar OSS e Quality Gate remotos
- [ ] Credenciais GitHub configuradas
- [ ] Imagens Docker Hub e releases publicadas
- [ ] Render DEV/HOMOL e CD automático
- [ ] CQRS cloud e comunicação autenticada
- [ ] Prometheus/Grafana com dados reais
- [ ] DEV na próxima PATCH, HOMOL na estável


## Evidências locais de 02/11/2026

- Produtos: 75 testes Jest aprovados; cobertura acima de 50% nas quatro métricas.
- Auth: 52 testes; Pedidos: 82 testes, ambos aprovados com cobertura.
- Tipagem de todos os workspaces e build de Produtos aprovados.
- Dockerfile construído; metadados conferidos no arquivo e nas labels da imagem.
- 12 testes Python de releases/deploy aprovados; actionlint sem avisos.
- Promtool aprovou configuração e duas regras com targets/tokens fictícios.
- Infra de teste isolada products-devops-test, porta 18080: Swagger UI/JSON e
  versão pública aprovados; fluxo completo e fluxo Inventory aprovados.
- Revisão independente: corrigido bloqueio de token interno público e de
  credenciais RabbitMQ locais na cloud; regressões verificadas RED → GREEN.
- PRODUCTS_SONAR_TOKEN e Variables PRODUCTS_SONAR_ORGANIZATION,
  PRODUCTS_SONAR_PROJECT_KEY e PRODUCTS_DOCKERHUB_USERNAME cadastrados no GitHub.

As evidências locais não comprovam publicação de imagem, deploy remoto nem
coleta de métricas dos ambientes cloud.


## Avanço remoto em 02/11/2026

- Feature publicada: f9d6575; pipeline Products 41514778788 aprovado.
- PR #19 feature/products-devops → develop: checks Products 41516706006 e
  Inventory 41516705866 aprovados; integrado em e65fd94.
- Develop alinhada previamente à main ef796c2, por fast-forward.
- Secrets PRODUCTS_SONAR_TOKEN e PRODUCTS_DOCKERHUB_TOKEN cadastrados; token
  Docker com leitura/escrita e validade de 30 dias, sem permissão de exclusão.
- Primeira prerelease: [products-v0.2.0-dev.3](https://github.com/guilhermeschr/trabalho-devops/releases/tag/products-v0.2.0-dev.3);
  publicação pelo [pipeline DEV aprovado](https://github.com/guilhermeschr/trabalho-devops/actions/runs/41520222482).
  Digest: `sha256:85064146ac752acae8c8bae233bb402e396df1479d05f892c73a1f29e49f9f09`.
- Formulário Render de Produtos DEV preparado com Existing Image e esse digest;
  plano Free confirmado ($0/mês). Serviço ainda não criado nem implantado.
- Quatro bancos e usuários próprios provisionados no PostgreSQL gratuito
  existente: products_dev_write, products_dev_read, products_homol_write,
  products_homol_read. Conexões TLS verificadas; CONNECT público revogado nesses
  bancos. Nenhuma tabela/banco Inventory foi acessado ou alterado.
- A instância gratuita expira em 30/11/2026; os bancos próprios compartilham
  recursos físicos, com dados e credenciais separados.
- Mensageria e Render de Produtos ainda em preparação; não representam CD
  completo. Não promover HOMOL antes da validação DEV.


## Acesso do CD preparado em 02/11/2026

- Chave Render `products-github-actions` criada após autorização explícita;
  acesso à API validado, sem registrar o valor. O formulário não oferece
  restrição por serviço; o CD seleciona apenas os IDs de Produtos.
- Secret `PRODUCTS_RENDER_API_KEY` confirmado nos Environments DEV e HOMOL.
- DEV aceita exclusivamente a branch develop; HOMOL exclusivamente main,
  sem regras de tags. Ainda faltam IDs/URLs de Produtos e habilitação do CD.
- Consulta à API confirmou Inventory DEV/HOMOL como serviços image-backed,
  sem repositório conectado; nenhuma configuração de Inventory foi alterada.
- Nenhum deploy de Produtos iniciado nesta etapa; mensageria própria pendente.


## Provisionamento cloud em 02/11/2026

| Ambiente | Serviço Render | URL pública | RabbitMQ |
|---|---|---|---|
| DEV | srv-dbkh38qjnfac73c1o8b0 | https://products-dev-4e3e.onrender.com | products-dev (Little Lemur gratuito) |
| HOMOL | srv-dbkh4anf3r2c73cftks0 | https://products-homol.onrender.com | products-homol (Little Lemur gratuito) |

- Ambos os serviços: imagem por digest, plano free, autoDeploy=no, repo/branch
  ausentes e health check /health. Nenhuma configuração Inventory alterada.
- Bootstrap com a imagem aprovada 0.2.0-dev.3, commit e65fd94, nos dois serviços;
  a identidade declara corretamente dev/homol. A release estável de HOMOL ainda
  depende da promoção e execução do CD; o bootstrap não a substitui.
- DEV validado: health, Swagger UI/JSON, 401 sem JWT/métricas, 403 sem token
  interno, criação autenticada, projeção CQRS, consulta interna e métricas.
- HOMOL validado: Swagger UI/JSON 404, health, versão, proteções HTTP, criação,
  projeção CQRS e consulta interna autenticada.
- IDs e URLs cadastrados nos respectivos Environments; PRODUCTS_DEPLOY_ENABLED
  habilitado. A execução real do job de CD ainda precisa ser comprovada.
- Instâncias RabbitMQ usam usuários/vhosts distintos; teste AMQPS publicou e
  consumiu mensagem em fila temporária exclusiva, removida ao fechar conexão.


## Quality Gate da primeira análise main

O pipeline 41541243661 bloqueou a publicação antes de criar imagem/release
estável. A análise apontou cobertura 95,5%, zero bugs/vulnerabilidades e
10,6% de duplicação. A duplicação concentrava-se nos schemas de escrita/leitura,
migrações e configuração de conexão CQRS. Excluir apenas migrações imutáveis e
mapeamentos *.orm-entity.ts do CPD preserva a independência dos bancos; as
demais regras continuam analisando esses arquivos. Não reduzir o limite do Gate.

Monitoramento real: ambos os targets UP no Prometheus localhost:9091; dashboard
Produtos — DEV e HOMOL provisionado no Grafana localhost:3002. Nesta máquina,
tokens foram instalados no volume products-monitoring-metrics com modo 0600 e
UID 65534; override local de Compose monta esse volume em /run/secrets.
A configuração versionada também suporta arquivos privados legíveis pelo
usuário do container. Não tornar tokens legíveis por outros usuários locais.

O Sonar classifica develop atualmente como SHORT, com Quality Gate OK. A
classificação de longa duração prevista no planejamento ainda não foi aplicada;
alterar a classificação existente exige recriar a análise e perder seu histórico.
