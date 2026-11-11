FROM nginx:1.27-alpine
RUN apk add --no-cache ca-certificates
COPY infra/nginx/render/nginx.conf.template /etc/nginx/nginx.conf.template
COPY infra/nginx/render/entrypoint.sh /gateway-entrypoint.sh
RUN chmod 755 /gateway-entrypoint.sh
ENTRYPOINT ["/gateway-entrypoint.sh"]
