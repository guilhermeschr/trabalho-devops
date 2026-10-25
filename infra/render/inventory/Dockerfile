FROM nginx:1.28-alpine
ENV PORT=10000 NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY infra/render/inventory/default.conf.template /etc/nginx/templates/default.conf.template
