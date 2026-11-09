# Monitoramento local de Auth

Exporte AUTH_DEV_URL e AUTH_HOMOL_URL como origens HTTPS reais e execute
`python3 monitoring/auth/configure.py`. Grave os respectivos tokens de
métricas em `.secrets/dev_metrics_token` e `.secrets/homol_metrics_token`, sem
prefixo Bearer, por editor/gerenciador de segredos. Não os versione nem cole no
histórico. Os arquivos devem ser legíveis pelo usuário do Prometheus.

Defina GRAFANA_ADMIN_PASSWORD e execute
`docker compose -f monitoring/auth/compose.yml up -d`.
Prometheus: http://localhost:9092/targets; Grafana: http://localhost:3003,
usuário admin. Dashboard Auth / Auth — DEV e HOMOL.

Gere tráfego DEV autenticado e aguarde duas coletas. `up` é sucesso da coleta,
não saúde integral dos bancos/CQRS. Esta configuração permanece ativa apenas
enquanto seu computador e os containers estiverem ligados. Não expõe portas
na internet e não hospeda Grafana no Render. As portas diferem de Produtos (9091/3002) e do Inventory (9090/3001).

Valide com `promtool check config /etc/prometheus/prometheus.yml` na imagem
prom/prometheus:v3.5.0 montando a pasta em /etc/prometheus e .secrets em
/run/secrets. O CI faz isso com targets/tokens fictícios, sem comprovar coleta
real. Alertas versionados não enviam notificações; não há Alertmanager.
