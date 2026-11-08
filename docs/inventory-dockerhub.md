# Docker Hub — Delivery Inventory

O GitHub Actions do repositório `guilhermeschr/trabalho-devops` publica somente
a imagem do Inventory em `docker.io/d2gtrabalhos/trabalho-devops-inventory`.
Esse endereço técnico é mantido para compatibilidade com os serviços Render.

- Variable de usuário: `INVENTORY_DOCKERHUB_USERNAME=d2gtrabalhos`.
- Secret de publicação: `INVENTORY_DOCKERHUB_TOKEN`, com leitura/escrita, sem exclusão.
- Tags: `X.Y.Z-dev-<sha>` para develop e `X.Y.Z-homol-<sha>` para main.
- O deploy usa `imagem@sha256:<digest>`; não usa `latest`.
- Labels OCI identificam origem, versão e commit.
- Features, PRs e execuções manuais apenas constroem, sem publicar.
- Builds sem publicação podem usar namespace `local` quando a Variable não existe.
- Publicação exige usuário válido, token e Quality Gate aprovado.

O Render baixa a imagem pública e recebe pelo CD o digest aprovado. A origem
configurada nos dois serviços deve corresponder a esse repositório de imagens.
Não habilitar atualizações paralelas por webhook, commit ou outro repositório.
As imagens históricas são preservadas para consulta e rollback manual.

O token de publicação tem vencimento: consulte sua data no Docker Hub e
atualize somente o Secret correspondente antes de expirar. Não versionar tokens.
O `GITHUB_TOKEN` não autentica publicação no Docker Hub.

A aplicação, os quatro bancos lógicos, RabbitMQ, autenticação, URLs públicas
e os serviços dos demais integrantes não dependem do nome exibido no Sonar.

Configuração completa: [CI/CD do Inventory](inventory-cicd.md).
