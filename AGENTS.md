# AGENTS.md - RDP Pro

## Workspace Obrigatorio

O workspace correto deste projeto e:

```text
C:\Users\Togszera\Desktop\RDP-Pro
```

Antes de qualquer leitura, edicao, teste, commit ou push, confirme que o comando esta rodando nesse diretorio. Nao use `C:\Users\Togszera\Documents\RDP-Pro`.

## Fluxo Obrigatorio de Desenvolvimento

Toda mudanca de desenvolvimento deve seguir esta ordem:

1. `senior-dev`
   - Sempre usar para ajustes, melhorias, bugs, ideias novas, funcionalidades novas e qualquer trabalho de desenvolvimento.
   - Implementa a mudanca com escopo pequeno, sem over-engineering e seguindo o padrao existente.

2. `ui-ux-expert` quando houver front-end
   - Para este projeto, front-end sempre deve acionar `ui-ux-expert`, mesmo sem `/ui-ux`.
   - Usar sempre que a mudanca tocar HTML, CSS, layout, componentes, responsividade, acessibilidade visual, microinteracoes ou experiencia do usuario.
   - Entra logo apos o `senior-dev` e antes do `code-reviewer`.
   - Faz diagnostico visual/UX e aplica ajustes cirurgicos sem alterar logica de negocio.
   - Se a mudanca de front-end for puramente logica e sem impacto visual/UX, registrar explicitamente que a etapa nao se aplica.

3. `code-reviewer`
   - Entra apos `ui-ux-expert` quando aplicavel; caso contrario, entra logo apos o `senior-dev`.
   - Faz revisao minuciosa das alteracoes, procurando regressao, bug, risco, quebra de fluxo e ausencia de cobertura.
   - Corrige o que for necessario antes de passar para QA.

4. `qa-senior`
   - Faz analise de impacto da mudanca.
   - Define casos de teste manuais, regressivos e automatizados conforme o impacto.
   - Se a mudanca toca algo existente, testes regressivos sao obrigatorios.

5. `qa-automate`
   - Cria ou ajusta testes automatizados a partir dos casos definidos pelo `qa-senior`.
   - Mantem os testes simples, executaveis localmente e alinhados ao app sem build step.

6. Validacao final
   - Rodar testes automatizados.
   - Revisar `git diff`.
   - Confirmar que nao entrou alteracao fora do escopo.

7. Git
   - Trabalhar sempre a partir de `develop`.
   - Nunca fazer push direto para `main`.
   - Fazer staging apenas dos arquivos revisados e pertencentes ao escopo.
   - Rodar `git diff --cached` antes de commitar.
   - Quando tudo estiver ok, fazer commit, push para `develop` e abrir ou atualizar PR `develop -> main` para aprovacao do usuario.

Se algum agent formal nao existir na sessao, simule a funcao como etapa explicita no proprio Codex e registre isso no resumo final. Quando houver ferramenta de subagents disponivel, usar subagents com esses papeis no prompt.

## Como Aplicar Este Kit Em Novos Projetos

1. Abra o novo projeto no workspace correto.
2. Crie uma branch `develop` a partir da branch principal, se ainda nao existir.
3. Copie este `AGENTS.md` e ajuste:
   - caminho do workspace;
   - stack do projeto;
   - comandos de teste;
   - arquivos sensiveis;
   - regra de cache/deploy, se houver;
   - remova regras especificas do projeto anterior antes de commitar.
4. Crie um `test.cmd` que rode a suite segura do projeto sem depender de `npm.ps1`.
5. Crie um teste de politica do repo para garantir que `AGENTS.md`, `.gitignore`, `test.cmd` e o workflow nao regridam.
6. Reestruture o `.gitignore` por categorias: dependencias, ambiente, estado local de ferramentas, logs e arquivos do sistema.
7. Crie um contexto publico versionavel quando o contexto principal for sensivel, por exemplo `PROJECT_CONTEXT.md`.
8. Rode testes, revise diff, faça commit em `develop`, push e PR `develop -> main`.

## Testes no Windows

No PowerShell, nao use `npm test`, porque `npm.ps1` pode ser bloqueado pela ExecutionPolicy.

Use um destes comandos:

```powershell
.\test.cmd
npm.cmd test
```

`test.cmd` e o caminho preferencial para evitar falhas de policy no Windows.

## Browser e ERR_BLOCKED_BY_CLIENT

Para este projeto, priorize testes automatizados locais e inspecoes estaticas para HTML/CSS/JS.

Se for necessario validar visualmente:

1. Rode primeiro `.\test.cmd`.
2. Nao usar Browser para `file://`, `localhost` ou `127.0.0.1`, salvo pedido explicito do usuario.
3. Se o usuario pedir Browser e aparecer `ERR_BLOCKED_BY_CLIENT`, pare imediatamente a tentativa visual.
4. Nao tente contornar com URLs alternativas repetidas, CDP bruto ou outro workaround.
5. Substitua a validacao visual por testes automatizados/estaticos que cubram o comportamento ou estilo alterado.

O objetivo e nao repetir ciclos improdutivos de Browser quando o bloqueio e do ambiente.

## Git e Escopo

- Preserve alteracoes existentes do usuario.
- Nao reverta arquivos que voce nao alterou.
- Antes de commitar, confira `git status --short --branch`.
- Nao inclua alteracoes pre-existentes sem necessidade.
- Use `git add -- <arquivo...>` com lista explicita; nao use `git add .` em worktree sujo.
- Se ja existir PR `develop -> main`, atualize/comente o PR existente em vez de tentar criar duplicado.
- Incrementar `CACHE_NAME` em `sw.js` quando houver deploy com mudancas em HTML/CSS/JS.
