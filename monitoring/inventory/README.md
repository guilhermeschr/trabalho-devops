# Monitoramento de Estoque

O Prometheus coleta as URLs públicas dos gateways usando tokens exclusivos de
métricas. O Grafana provisiona automaticamente o dashboard Inventory.
Os dois serviços desta configuração escutam apenas em localhost.

1. Exporte `INVENTORY_DEV_URL` e `INVENTORY_HOMOL_URL` com as origens HTTPS reais.
2. Execute `python3 monitoring/inventory/configure.py` na raiz.
3. Crie `monitoring/inventory/.secrets/dev_metrics_token` e
   `monitoring/inventory/.secrets/homol_metrics_token` contendo apenas o token
   configurado no Spring correspondente (sem `Bearer `). Forneça os arquivos
   por um editor local ou gerenciador de segredos; não cole tokens em comandos
   que fiquem no histórico. Esses arquivos são ignorados pelo Git.
4. Garanta que o usuário do Prometheus no container possa ler os arquivos
   montados. O diretório de segredos não deve ficar acessível por HTTP.
5. Exporte `GRAFANA_ADMIN_PASSWORD` com senha forte em seu terminal.
6. Execute `docker compose -f monitoring/inventory/compose.yml up -d`.
7. Abra Prometheus em `http://localhost:9090/targets` e confirme ambos UP.
8. Abra Grafana em `http://localhost:3001`, usuário `admin` (ou
   `GRAFANA_ADMIN_USER`) e sua senha; pasta Inventory, dashboard Inventory.

Targets gerados ficam em `targets/`, ignorado pelo Git. Não há endpoints fictícios
ativos no repositório. A coleta falhará até URLs e tokens reais serem fornecidos.
Faça requisições autenticadas de teste à API DEV para produzir séries de tráfego;
latência/RPS podem ficar vazias antes de haver requisições e duas coletas.

Para acesso do avaliador, use Grafana Cloud com o JSON de dashboard e uma fonte
Prometheus conectada, ou hospede esta configuração em infraestrutura própria
com HTTPS e controle de acesso. Não publique as portas do Prometheus diretamente
na internet. As URLs compartilháveis e os dados reais ainda dependem desse
provisionamento. Configure notificações separadamente se desejado; as regras
Prometheus fornecidas não enviam mensagens por si mesmas.

Validação da configuração com ferramentas da própria imagem:

```sh
docker run --rm --entrypoint promtool \
  -v "$PWD/monitoring/inventory:/etc/prometheus:ro" \
  -v "$PWD/monitoring/inventory/.secrets:/run/secrets:ro" \
  prom/prometheus:v3.5.0 check config /etc/prometheus/prometheus.yml
```

Crie primeiro os arquivos de token descritos acima. Sem eles o check acusa
ausência dos arquivos em `/run/secrets`.
A disponibilidade da coleta usa a métrica `up`, os erros usam a taxa de respostas
5xx e o p95 usa os buckets HTTP habilitados no Spring.
