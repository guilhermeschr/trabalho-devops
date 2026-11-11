# Gateway no Render

A imagem `d2gtrabalhos/delivery-gateway:0.1.0` foi publicada e os dois
serviços Render usam o digest
`sha256:3fac7170ed20e23cc94e9693f63415f328fa3dc82943e2f2ee407e3f4dd77c60`.

| Ambiente | Gateway | Serviço Render |
|---|---|---|
| DEV | https://gateway-dev-nw8k.onrender.com | `srv-dbqef80ae00c7385nckg` |
| HOMOL | https://gateway-homol-msdr.onrender.com | `srv-dbqefo8ae00c7385os90` |

Cada serviço usa plano Free, `PORT` fornecida pelo Render, health check
`/health` e origens HTTPS configuradas em `AUTH_SERVICE_URL`,
`PRODUCTS_SERVICE_URL`, `INVENTORY_SERVICE_URL` e `ORDERS_SERVICE_URL`.
O health check não verifica as dependências. A imagem é construída para
`linux/amd64` com `infra/nginx/render/Dockerfile`.

No serviço Pedidos de cada ambiente, confira que `PRODUCTS_SERVICE_URL` e
`INVENTORY_SERVICE_URL` apontam às origens diretas correspondentes e que o
`INTERNAL_SERVICE_TOKEN` coincide com o configurado nesses dois serviços.
O gateway bloqueia `/internal/`; as chamadas internas são feitas diretamente
por HTTPS e exigem token. Os destinos continuam publicamente acessíveis.

Os ambientes `docs/bruno/environments/dev.yml` e `homol.yml` contêm as URLs
dos gateways. Na cópia local atualmente modificada, a
requisição de cadastro A possui uma variável `baseUrl` própria: remova essa
sobreposição no Bruno para usar o ambiente selecionado. Confira também as
variáveis `senha` antes de executar a coleção. Execute as pastas 1 a 5 em
ordem; a pasta 6 exige interromper Estoque e não integra o fluxo normal.
As execuções criam dados persistentes. A projeção é eventualmente consistente;
aguarde a atualização caso uma consulta inicial ainda não mostre os dados.

Valide também com `GATEWAY_URL=https://<gateway> node scripts/verify-flow.mjs`.
O roteiro aguarda as projeções e verifica autenticação, isolamento das rotas
internas no gateway, pedido, conclusão idempotente e débito de estoque.

Em 11/11/2026, `scripts/verify-flow.mjs` passou em DEV e HOMOL. Produtos e
Estoque retornaram 403 sem token e com token inválido nas chamadas diretas
internas em ambos os ambientes. Os fluxos criaram dados persistentes de teste.

A coleção Bruno (pastas 1 a 5) também passou com 33 de 33 asserções em
cada ambiente, usando cópia temporária sem as sobreposições locais existentes.
