#!/bin/sh
set -eu
: "${PORT:=10000}"
case "$PORT" in *[!0-9]*|'') echo 'PORT inválida' >&2; exit 1;; esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then echo 'PORT inválida' >&2; exit 1; fi
for service in AUTH PRODUCTS INVENTORY ORDERS; do
  eval "url=\${${service}_SERVICE_URL:-}"
  case "$url" in https://*.onrender.com) ;; *) echo "${service}_SERVICE_URL deve ser uma origem HTTPS onrender.com" >&2; exit 1;; esac
  host=${url#https://}
  case "$host" in *[!a-zA-Z0-9.-]*|.*|*..*|*.) echo "Host inválido em ${service}_SERVICE_URL" >&2; exit 1;; esac
  export "${service}_HOST=$host"
done
export PORT
envsubst '${PORT} ${AUTH_HOST} ${PRODUCTS_HOST} ${INVENTORY_HOST} ${ORDERS_HOST}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
nginx -t
exec nginx -g 'daemon off;'
