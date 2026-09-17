# Instruções para agentes e colaboradores

## 1. Fonte de verdade

Antes de analisar, alterar ou criar qualquer arquivo do projeto, leia:

1. Este arquivo, `AGENTS.md`.
2. `docs/especificacao-delivery-microservicos.md`.

O arquivo `docs/especificacao-delivery-microservicos.md` é a fonte de verdade para:

- Arquitetura dos microsserviços.
- Limites e responsabilidades de cada serviço.
- Rotas externas e internas.
- Parâmetros, respostas e códigos HTTP.
- Fluxos REST entre serviços.
- CQRS, RabbitMQ e Outbox.
- Bancos de escrita e leitura.
- Injeção de dependências.
- Regras de autenticação.
- Testes e cobertura mínima.
- Infraestrutura Docker Compose e Nginx.

Nenhuma implementação deverá criar uma divergência silenciosa em relação à especificação.

## 2. Processo obrigatório de trabalho

Para toda alteração:

1. Verifique o estado atual com `git status --short`.
2. Preserve alterações existentes que não pertençam à tarefa.
3. Leia a especificação e identifique as seções afetadas.
4. Defina a menor alteração que atende ao requisito.
5. Implemente mantendo os limites dos microsserviços.
6. Atualize a especificação na mesma tarefa quando o comportamento, contrato ou infraestrutura mudar.
7. Execute os testes e a verificação de cobertura aplicáveis.
8. Revise o diff completo, incluindo a especificação.
9. Verifique que nenhum segredo, senha, token ou `.env` real foi adicionado.
10. Crie um commit para a alteração relevante.

Se o código e a especificação ficarem incompatíveis, interrompa a implementação e corrija a especificação ou solicite uma decisão explícita. Não escolha uma solução divergente apenas para fazer os testes passarem.

## 3. Quando atualizar a especificação

Atualize `docs/especificacao-delivery-microservicos.md` sempre que uma alteração relevante:

- Criar, remover ou renomear uma rota.
- Alterar método HTTP, autenticação, parâmetros, respostas ou códigos de erro.
- Alterar o fluxo de criação ou conclusão de pedidos.
- Alterar o status ou uma regra de negócio.
- Alterar uma comunicação REST ou evento RabbitMQ.
- Alterar bancos, tabelas, projeções, Outbox ou consistência.
- Alterar variáveis de ambiente, containers, portas ou configuração do Nginx.
- Alterar a estratégia de injeção de dependências.
- Alterar testes, critérios de aceite ou cobertura mínima.
- Adicionar uma dependência ou tecnologia.

A atualização deverá refletir o comportamento real, incluindo exemplos JSON, tabelas de rotas, fluxos e checklist de aceite. Quando a especificação for alterada, atualize também a versão e registre um resumo no histórico de alterações. Se o histórico ainda não existir, crie uma seção `Histórico de alterações`.

Quando código e especificação descrevem o mesmo comportamento, prefira colocá-los no mesmo commit lógico. Alterações exclusivamente editoriais ou de organização podem usar um commit separado.

## 4. Padrões arquiteturais que não podem ser quebrados

- O Nginx é o gateway das rotas externas.
- Rotas com prefixo `/internal/` são exclusivamente internas e não podem ser expostas pelo Nginx.
- A comunicação entre microsserviços é REST síncrona.
- RabbitMQ é usado para atualizar os modelos de leitura do CQRS.
- Produtos e Estoque possuem bancos de escrita e leitura separados.
- Auth e Pedidos possuem bancos próprios.
- Alterações de escrita em Produtos e Estoque devem registrar a Outbox na mesma transação.
- Consumidores de eventos devem ser idempotentes.
- Consultas devem usar os bancos de leitura correspondentes.
- JWT autentica chamadas externas.
- `X-Internal-Token` protege chamadas internas entre serviços.
- Controllers dependem de casos de uso, e casos de uso dependem de interfaces.
- Dependências devem ser registradas e recebidas por injeção do NestJS.
- Não instancie manualmente repositórios, clientes HTTP, publishers ou conexões dentro de controllers e casos de uso.
- Não acesse diretamente o banco de outro microsserviço.

## 5. Documentação Swagger das rotas

Toda rota criada ou alterada deverá ser documentada corretamente no Swagger.

Regras obrigatórias:

- Controllers devem declarar tags e operações com decorators Swagger.
- Parâmetros de rota, corpos, headers e autenticação devem aparecer no
  documento OpenAPI.
- Códigos HTTP, schemas, exemplos e mensagens documentados devem refletir o
  comportamento real da aplicação.
- Rotas públicas, internas e de infraestrutura devem aparecer no endpoint
  `/docs-json`.
- Rotas internas devem ser identificadas com tag própria e continuar bloqueadas
  pelo Nginx.
- Toda alteração de rota deve atualizar o teste automatizado do contrato
  Swagger.
- Toda nova rota deve ser verificada com `npm run verify:swagger:products`.
- Swagger deve permanecer desabilitado em produção.

## 6. Testes e qualidade

Cada microsserviço deve possuir testes unitários próprios.

A cobertura mínima exigida por microsserviço é de 50% para:

- Branches.
- Functions.
- Lines.
- Statements.

Toda alteração de comportamento deve incluir ou atualizar testes para:

- Caminho de sucesso.
- Validação de entrada.
- Erros relevantes.
- Dependências externas mockadas.
- Regras de idempotência ou autorização, quando aplicável.

Antes de criar o commit, execute os testes e a cobertura do serviço afetado. Em alterações que atravessam serviços, execute também o roteiro de comunicação definido na especificação. Se não houver código ou suíte de testes disponível, registre essa limitação no resultado da tarefa e faça as verificações documentais possíveis.

## 7. Padrão de commits

Toda alteração com relevância funcional, arquitetural, de infraestrutura, testes ou documentação deverá possuir um commit próprio e logicamente agrupado.

Use este formato para o título:

`<tipo>(<escopo>): <descrição imperativa>`

Regras do título:

- Escreva o tipo, o escopo e a descrição em português do Brasil.
- Use letras minúsculas no tipo e no escopo, sem acentos ou espaços.
- Descreva a ação no imperativo, de forma específica.
- Não termine o título com ponto.
- Prefira no máximo 72 caracteres.
- Não use títulos genéricos como `update`, `changes` ou `ajustes`.

Tipos permitidos:

| Tipo | Uso |
|---|---|
| `funcionalidade` | Nova funcionalidade ou rota |
| `correcao` | Correção de comportamento |
| `documentacao` | Especificação ou documentação |
| `teste` | Inclusão ou ajuste de testes |
| `refatoracao` | Refatoração sem mudança funcional |
| `build` | Dependências ou processo de build |
| `manutencao` | Manutenção técnica |
| `desempenho` | Melhoria de desempenho |
| `ci` | Integração ou automação de CI, quando autorizada |

Exemplos válidos:

- `documentacao(especificacao): definir rota de conclusão de pedido`
- `funcionalidade(pedidos): implementar conclusão de pedido`
- `teste(estoque): cobrir débito idempotente de estoque`
- `correcao(auth): rejeitar e-mail de usuário duplicado`
- `build(infra): configurar health check do RabbitMQ`
- `refatoracao(produtos): separar repositório do modelo de leitura`

Use o corpo do commit quando a alteração exigir contexto. O corpo deve explicar:

- Por que a mudança foi necessária.
- O que foi alterado.
- Quais testes ou verificações foram executados.

Antes do commit:

1. Adicione somente os arquivos pertencentes à alteração.
2. Revise `git diff --cached`.
3. Execute `git diff --cached --check`.
4. Confirme que os testes e a cobertura exigida foram executados.

Não use `git add -A` ou `git add .` quando isso puder incluir alterações não relacionadas.

## 8. Padrão de branches

Toda branch nova deverá:

- Usar nome em português do Brasil.
- Usar letras minúsculas.
- Não conter acentos, espaços ou caracteres especiais.
- Separar palavras com hífen.
- Nunca utilizar o prefixo `codex/`.
- Utilizar uma das categorias abaixo:

| Categoria | Uso |
|---|---|
| `funcionalidade/` | Nova funcionalidade ou serviço |
| `correcao/` | Correção de comportamento |
| `documentacao/` | Alteração de documentação |
| `refatoracao/` | Refatoração sem mudança funcional |
| `manutencao/` | Manutenção técnica |
| `infraestrutura/` | Docker, Nginx ou ambiente |

Formato obrigatório: `<categoria>/<descricao-em-minusculas>`.

Exemplos:

- `funcionalidade/produtos-inicial`
- `correcao/validacao-de-preco`
- `infraestrutura/configurar-rabbitmq`

Para criar uma branch, use:

`git switch -c funcionalidade/produtos-inicial`

Não crie branches diretamente com o prefixo `codex/`.

## 9. Push e integração

Não faça push, merge ou criação de Pull Request sem solicitação explícita do usuário.

Quando o push for solicitado:

1. Confirme que o commit local está correto.
2. Confirme que não há arquivos sensíveis.
3. Confirme o branch e o remote de destino.
4. Faça o push sem sobrescrever histórico remoto.
5. Informe o commit e o resultado do push.

Nunca use `git reset --hard`, force push ou descarte de alterações do usuário sem autorização explícita.

## 10. Definição de pronto

Uma tarefa só está pronta quando:

- A implementação segue a especificação.
- A especificação foi atualizada quando necessário.
- Rotas externas e internas continuam corretamente separadas.
- Testes relevantes foram executados.
- A cobertura mínima foi respeitada ou a limitação foi registrada.
- O diff foi revisado.
- Não há segredos versionados.
- Existe um commit com título padronizado para a alteração relevante.
