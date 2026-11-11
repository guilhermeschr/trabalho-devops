# Gateway no Render

A imagem está preparada em `infra/nginx/render/`, mas sua publicação e os
serviços Render ainda precisam ser concluídos. A tentativa local de publicação
em `d2gtrabalhos/delivery-gateway:0.1.0` foi recusada pelo Docker Hub por falta
de autorização. A autenticação deve ser feita pelo responsável pela conta;
não grave credenciais no repositório.

Construa para `linux/amd64` com o Dockerfile do gateway e publique em um
repositório Docker Hub autorizado. Crie dois Web Services no Render usando
**Existing Image** e o digest da imagem publicada. Configure por serviço:

- `AUTH_SERVICE_URL`, `PRODUCTS_SERVICE_URL`, `INVENTORY_SERVICE_URL` e
  `ORDERS_SERVICE_URL`: origens HTTPS `onrender.com`, sem barra final ou
  caminho, todas do mesmo ambiente.
- `PORT`: fornecida pelo Render; o padrão da imagem é 10000.
- Health check: `/health`. Esse teste não verifica as dependências.

No serviço Pedidos de cada ambiente, confira que `PRODUCTS_SERVICE_URL` e
`INVENTORY_SERVICE_URL` apontam às origens diretas correspondentes e que o
`INTERNAL_SERVICE_TOKEN` coincide com o configurado nesses dois serviços.
O gateway bloqueia `/internal/`; as chamadas internas são feitas diretamente
por HTTPS e exigem token. Os destinos continuam publicamente acessíveis.

Após o deploy, preencha `baseUrl` nos ambientes `docs/bruno/environments/dev.yml`
e `homol.yml` com as URLs reais. Na cópia local atualmente modificada, a
requisição de cadastro A possui uma variável `baseUrl` própria: remova essa
sobreposição no Bruno para usar o ambiente selecionado. Confira também as
variáveis `senha` antes de executar a coleção. Execute as pastas 1 a 5 em
ordem; a pasta 6 exige interromper Estoque e não integra o fluxo normal.
As execuções criam dados persistentes. A projeção é eventualmente consistente;
aguarde a atualização caso uma consulta inicial ainda não mostre os dados.

Valide também com `GATEWAY_URL=https://<gateway> node scripts/verify-flow.mjs`.
O roteiro aguarda as projeções e verifica autenticação, isolamento das rotas
internas no gateway, pedido, conclusão idempotente e débito de estoque.
