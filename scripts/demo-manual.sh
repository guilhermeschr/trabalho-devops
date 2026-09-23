#!/usr/bin/env bash
# Demonstração guiada do roteiro de apresentação (docs/roteiro-apresentacao.md).
# Executa as chamadas pelo gateway, imprime cada passo e confere o HTTP esperado.
# Uso: bash scripts/demo-manual.sh [--pausa]   (GATEWAY_URL, padrão http://localhost:8080)
set -euo pipefail

BASE="${GATEWAY_URL:-http://localhost:8080}"
BASE="${BASE%/}"
PAUSA=0
[[ "${1:-}" == "--pausa" ]] && PAUSA=1
FALHAS=0
SUFIXO="$(date +%s)"
TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT

json() { node -pe "const v=JSON.parse(require('fs').readFileSync(0,'utf8'));$1"; }

# passo <descrição> <http esperado> <método> <rota> [corpo] [token] [header extra]
passo() {
  local desc="$1" esperado="$2" metodo="$3" rota="$4" corpo="${5:-}" token="${6:-}" extra="${7:-}"
  local args=(-s -o "$TMP_BODY" -w '%{http_code}' -X "$metodo" "$BASE$rota"
    -H 'Content-Type: application/json' -H "X-Request-Id: demo-$SUFIXO-$RANDOM")
  [[ -n "$corpo" ]] && args+=(-d "$corpo")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$extra" ]] && args+=(-H "$extra")
  local status
  status="$(curl "${args[@]}")"
  BODY="$(cat "$TMP_BODY")"
  local marca="OK"
  if [[ "$status" != "$esperado" ]]; then marca="FALHOU (esperado $esperado)"; FALHAS=$((FALHAS + 1)); fi
  printf '\n\033[1m▶ %s\033[0m\n  %s %s → HTTP %s  [%s]\n' "$desc" "$metodo" "$rota" "$status" "$marca"
  printf '%s' "$BODY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.stringify(JSON.parse(s),null,2).replace(/^/gm,"  ").slice(0,1200))}catch{console.log("  "+s.slice(0,200))}})'
  if (( PAUSA )); then read -r -p "  [Enter para continuar]" _; fi
}

aguardar() { # aguardar <rota> <token> <expressão JS sobre v>
  for _ in $(seq 1 40); do
    if curl -s "$BASE$1" -H "Authorization: Bearer $2" | json "($3)?1:0" 2>/dev/null | grep -q 1; then return 0; fi
    sleep 0.25
  done
  echo "  (projeção não convergiu em 10 s)"; FALHAS=$((FALHAS + 1))
}

EMAIL_A="maria-$SUFIXO@example.com"
EMAIL_B="joao-$SUFIXO@example.com"
SENHA="SenhaSegura123"

echo "Gateway: $BASE"

passo "1. Cadastro do usuário A" 201 POST /api/v1/auth/register \
  "{\"name\":\"Maria Silva\",\"email\":\"$EMAIL_A\",\"password\":\"$SENHA\"}"
passo "1b. E-mail duplicado" 409 POST /api/v1/auth/register \
  "{\"name\":\"Maria Silva\",\"email\":\"$EMAIL_A\",\"password\":\"$SENHA\"}"
passo "1c. Senha curta" 400 POST /api/v1/auth/register \
  "{\"name\":\"Maria\",\"email\":\"curta-$SUFIXO@example.com\",\"password\":\"123\"}"

passo "2. Login do usuário A" 200 POST /api/v1/auth/login "{\"email\":\"$EMAIL_A\",\"password\":\"$SENHA\"}"
TOKEN="$(printf '%s' "$BODY" | json 'v.accessToken')"
passo "2b. Login com senha errada" 401 POST /api/v1/auth/login "{\"email\":\"$EMAIL_A\",\"password\":\"errada123\"}"
passo "2c. Rota protegida sem JWT" 401 GET /api/v1/products

passo "3. Criar produto" 201 POST /api/v1/products \
  '{"name":"Hambúrguer artesanal","description":"Com queijo e molho especial","price":29.90,"active":true}' "$TOKEN"
PRODUCT_ID="$(printf '%s' "$BODY" | json 'v.id')"
passo "3b. Editar produto (PUT)" 200 PUT "/api/v1/products/$PRODUCT_ID" \
  '{"name":"Hambúrguer artesanal especial","description":"Com queijo, bacon e molho especial","price":34.90,"active":true}' "$TOKEN"
passo "3c. Preço inválido" 400 POST /api/v1/products \
  '{"name":"X","description":"Y","price":-1,"active":true}' "$TOKEN"
aguardar "/api/v1/products?id=$PRODUCT_ID" "$TOKEN" 'v.length===1&&v[0].price===34.9'
passo "3d. Consultar produto na projeção (filtro id)" 200 GET "/api/v1/products?id=$PRODUCT_ID" "" "$TOKEN"
passo "3e. Filtro por nome parcial" 200 GET "/api/v1/products?name=especial" "" "$TOKEN"

passo "4. Adicionar estoque (20)" 200 POST /api/v1/inventory "{\"productId\":\"$PRODUCT_ID\",\"quantity\":20}" "$TOKEN"
aguardar "/api/v1/inventory/$PRODUCT_ID" "$TOKEN" 'v.availableQuantity===20'
passo "4b. Consultar estoque na projeção" 200 GET "/api/v1/inventory/$PRODUCT_ID" "" "$TOKEN"

passo "5. Criar pedido (2 unidades)" 201 POST /api/v1/orders "{\"productId\":\"$PRODUCT_ID\",\"quantity\":2}" "$TOKEN"
ORDER_ID="$(printf '%s' "$BODY" | json 'v.id')"
passo "5b. Estoque insuficiente" 409 POST /api/v1/orders "{\"productId\":\"$PRODUCT_ID\",\"quantity\":1000}" "$TOKEN"
passo "5c. Produto inexistente" 404 POST /api/v1/orders \
  '{"productId":"00000000-0000-4000-8000-000000000000","quantity":1}' "$TOKEN"
passo "5d. userId no corpo é rejeitado" 400 POST /api/v1/orders \
  "{\"productId\":\"$PRODUCT_ID\",\"quantity\":1,\"userId\":\"00000000-0000-4000-8000-000000000000\"}" "$TOKEN"

passo "6. Consultar pedido" 200 GET "/api/v1/orders/$ORDER_ID" "" "$TOKEN"
passo "6b. Cadastro do usuário B" 201 POST /api/v1/auth/register \
  "{\"name\":\"João Souza\",\"email\":\"$EMAIL_B\",\"password\":\"$SENHA\"}"
passo "6c. Login do usuário B" 200 POST /api/v1/auth/login "{\"email\":\"$EMAIL_B\",\"password\":\"$SENHA\"}"
TOKEN_B="$(printf '%s' "$BODY" | json 'v.accessToken')"
passo "6d. Usuário B consulta pedido de A" 403 GET "/api/v1/orders/$ORDER_ID" "" "$TOKEN_B"
passo "6e. Usuário B tenta concluir pedido de A" 403 POST "/api/v1/orders/$ORDER_ID/complete" "" "$TOKEN_B"

passo "7. Concluir pedido" 200 POST "/api/v1/orders/$ORDER_ID/complete" "" "$TOKEN"
passo "7b. Repetir conclusão (idempotente)" 200 POST "/api/v1/orders/$ORDER_ID/complete" "" "$TOKEN"
aguardar "/api/v1/inventory/$PRODUCT_ID" "$TOKEN" 'v.availableQuantity===18'
passo "7c. Estoque projetado após o débito (18)" 200 GET "/api/v1/inventory/$PRODUCT_ID" "" "$TOKEN"

passo "8. Desativar produto" 200 PUT "/api/v1/products/$PRODUCT_ID" \
  '{"name":"Hambúrguer artesanal especial","description":"Fora do cardápio","price":34.90,"active":false}' "$TOKEN"
aguardar "/api/v1/products?id=$PRODUCT_ID" "$TOKEN" 'v.length===1&&v[0].active===false'
passo "8b. Pedido de produto inativo" 409 POST /api/v1/orders "{\"productId\":\"$PRODUCT_ID\",\"quantity\":1}" "$TOKEN"

passo "9. Gateway bloqueia /internal/ (mesmo com token)" 404 GET "/internal/v1/products/$PRODUCT_ID" "" "" \
  "X-Internal-Token: token-qualquer"
passo "9b. GET em /api/v1/products/:id não é permitido" 405 GET "/api/v1/products/$PRODUCT_ID"
passo "9c. Rota inexistente" 404 GET /api/v1/nao-existe

echo
echo "PRODUCT_ID=$PRODUCT_ID ORDER_ID=$ORDER_ID"
if (( FALHAS )); then echo "Demonstração concluída com $FALHAS falha(s)."; exit 1; fi
echo "Demonstração concluída: todos os passos retornaram o HTTP esperado."
