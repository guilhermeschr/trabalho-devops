# Implementação DevOps de Produtos

> Executar com superpowers:executing-plans, tarefas pequenas, testes de comportamento e revisão final independente.

**Objetivo:** CI/CD de Produtos gratuito com releases, Render DEV/HOMOL e métricas.
**Arquitetura:** NestJS/TypeORM/CQRS preservados; Render direto protegido, Docker Hub, SonarCloud, Prometheus/Grafana local.
**Especificação:** ../specs/2026-11-02-products-devops-design.md e ../../especificacao-delivery-microservicos.md.

## Restrições

Cobertura mínima 50% nas quatro métricas Jest; sem segredos versionados; preservar alterações locais; main=HOMOL, develop=DEV; feature/products-devops; commits em português; nenhum recurso pago.

## Atenção da revisão

Retentativas não sobrescrevem releases; falha de gate bloqueia publicação; Swagger HOMOL bloqueado; configuração cloud não aceita credenciais fictícias; métricas não expõem caminhos/IDs arbitrários.

## Tarefas

1. [x] Conferir remoto, alinhar develop local por fast-forward e criar worktree/feature; baseline Produtos 54 testes.
2. [x] Versão pública, porta, TLS, secrets cloud, Swagger e métricas: escrever testes, observar falha, implementar, executar suíte/tipagem/build e contrato Swagger; atualizar especificação; commit.
3. [x] Metadados imutáveis, release idempotente, script Render e workflow: testes Python de versões/deploy, implementar, validar workflow e build Docker; commit com especificação.
4. [x] Prometheus/Grafana provisionados e Dependabot: validar promtool/Compose/dashboard, testar coleta, documentar e commit.
5. [x] Criar/configurar Sonar gratuito e Docker Hub via Safari; configurar Secrets/Environments e Render após validar permissões e dados gratuitos. Não declarar concluído sem evidências.
6. [x] Executar fluxo, revisar branch, corrigir achados importantes, commits e validações finais.
7. [x] Publicar feature, validar DEV após integração em develop, promover main/HOMOL; incrementar PATCH só em develop; evidências de versão/digest/monitoramento.

Cada etapa dependente de plataforma externa exige pré-condições reais. Se houver bloqueio externo, registrar qual e concluir o trabalho local independente.

Evidências finais: docs/products-devops.md. DEV 0.2.1-dev.19, HOMOL 0.2.0;
pipelines CD aprovados, contratos HTTP e Prometheus/Grafana reais validados.
Limitação: Sonar develop SHORT preservado para não apagar histórico.
