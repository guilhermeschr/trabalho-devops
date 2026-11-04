# Docker Hub — Inventory

A migração troca somente o registro de publicação e a origem das imagens nos
serviços Render. Aplicação, bancos, RabbitMQ, autenticação e monitoramento são
preservados. Nenhum serviço dos demais integrantes é alterado.

## Configuração

- Imagem: `docker.io/d2gtrabalhos/trabalho-devops-inventory`.
- Docker Hub: repositório público `d2gtrabalhos/trabalho-devops-inventory`.
- Variable do GitHub: `INVENTORY_DOCKERHUB_USERNAME=d2gtrabalhos`.
- Secret do GitHub: `INVENTORY_DOCKERHUB_TOKEN`, token de leitura/escrita,
  sem exclusão; consultar o vencimento na conta Docker e renovar o Secret.
- GITHUB_TOKEN continua sendo emitido pelo GitHub, mas não publica no Docker Hub.
- Tags: `X.Y.Z-dev-<sha>` e `X.Y.Z-homol-<sha>`; CD usa digest imutável.
- Jobs, gatilhos, Quality Gate e mapeamento develop/DEV e main/HOMOL preservados.
- A permissão GitHub packages:write não é mais necessária e foi removida.
- Builds de PRs, features e execuções manuais não publicam. Se a Variable de
  usuário não estiver disponível, usam `docker.io/local/<repositorio>-inventory`
  somente como nome do build. Pushes de develop/main rejeitam usuário vazio;
  a autenticação Docker Hub e o Quality Gate continuam obrigatórios.

## Sequência de migração

1. Criar repositório público e cadastrar a credencial de publicação em Secrets.
2. Preparar a alteração na feature, executar os testes e aprovar os checks.
3. Manter `INVENTORY_DEPLOY_ENABLED=false` durante a primeira publicação no novo
   registro, preservando os serviços que já estão live.
4. Integrar feature → develop → main após os checks, somente no fork, para
   publicar as primeiras imagens DEV e HOMOL no Docker Hub.
5. Confirmar acesso público às tags e digests publicados.
6. No Render, ajustar Settings → Image → Source dos dois serviços existentes
   para suas imagens Docker Hub. Essa troca também inicia uma implantação.
7. A API Render exige host/repositório/nome de imagem compatíveis com Source.
8. Reativar `INVENTORY_DEPLOY_ENABLED=true` e validar os fluxos de push até live,
   com readiness, JWT, token interno, métricas e Swagger.
9. Conferir Prometheus/Grafana após os deploys. Não apagar imagens GHCR antigas.

Uma configuração no original exigirá seu próprio usuário/token Docker,
Environments e Variables. Um PR transfere somente os arquivos. Manter apenas
um controlador de deploy ativo para esses serviços.

## Validação

O controle de deploy rejeita tags, registros externos, credenciais embutidas e
referências inválidas; aceita somente Docker Hub com namespace/repositório e
digest sha256. Os testes da negociação HTML/JSON e dos contratos DEV/HOMOL
continuam obrigatórios. Resultados remotos devem ser registrados somente após
a publicação e os deploys reais.

## Transferência para o original

O repositório original mantém os Secrets Sonar existentes da conta do responsável
pelo Inventory; validar a etapa Sonar e Quality Gate, não somente o job quality.
O Secret `INVENTORY_RENDER_API_KEY` pode ficar no nível do repositório quando a
mesma chave atende DEV/HOMOL; os IDs e URLs permanecem nas Variables dos respectivos
Environments. Credenciais de outros microsserviços não são reutilizadas.
Desabilitar `INVENTORY_DEPLOY_ENABLED` no fork antes de habilitar no original.
Preservar as seções e o histórico dos demais serviços ao resolver conflitos.
