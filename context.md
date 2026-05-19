# CONTEXT.md - RDP Pro

## O que e

PWA de Registro de Pensamentos para TCC, versao B2B para psicologos oferecerem a ferramenta aos pacientes.

Rotas principais:
- Paciente: `/paciente.html`
- Profissional: `/psicologo.html`
- Compatibilidade: `/index.html`, `/therapist.html`, `?token=`

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | HTML5 + CSS3 + JS vanilla |
| Persistencia | localStorage offline-first + Supabase sync |
| Auth | Supabase Auth para profissionais e pacientes |
| Backend | Supabase PostgreSQL + RLS + Edge Functions |
| E-mail | Resend API via Edge Function |
| Graficos | Chart.js via CDN |
| PDF | jsPDF via CDN |
| PWA | Service Worker versionado manualmente |

Sem framework JS, sem bundler e sem build step.

## Estrutura

```
rdp-pro/
|-- paciente.html
|-- psicologo.html
|-- index.html              # compatibilidade
|-- therapist.html          # compatibilidade
|-- manifest.json
|-- sw.js
|-- css/
|-- js/
|-- icons/
`-- supabase/
    |-- migrations/
    |   |-- 001_initial_schema.sql
    |   |-- 002_fix_rls_security.sql
    |   `-- 003_patient_auth_ptbr_routes.sql
    `-- functions/
        |-- enviar-relatorio/
        `-- send-report/    # compatibilidade
```

## Banco

Projeto Supabase: `ofojfewdeamfackofjgt`

Tabelas:
- `therapists`: profissionais vinculados a `auth.users`.
- `patients`: pacientes vinculados ao profissional e, agora, a `auth.users` por `user_id`.
- `records`: registros TCC.

Campos relevantes em `patients`:
- `invite_token`: usado para introduzir/vincular a conta.
- `invite_used_at`: preenchido quando a conta do paciente e vinculada; convites usados deixam de validar no app.
- `user_id`: conta Supabase Auth do paciente.
- `full_name`, `email`, `active`, `last_seen_at`.

## Fluxo

### Profissional

1. Acessa `/psicologo.html`.
2. Cria conta ou entra com Supabase Auth.
3. Cria convite para o paciente.
4. O link gerado usa `/paciente.html?convite=...`.
5. Visualiza registros e ajusta configuracoes.

### Paciente

1. Abre o convite.
2. Cria conta ou entra com e-mail e senha.
3. O app chama `claim_patient_invite` e vincula `patients.user_id`.
4. Depois disso, pode acessar sem o link.
5. Registros continuam offline-first no localStorage e sincronizam com Supabase.
6. Relatorio e enviado por `functions/v1/enviar-relatorio`.

## RPCs principais

- `get_patient_by_token(p_token)`: valida convite ainda nao usado e mostra contexto inicial.
- `claim_patient_invite(p_token, p_full_name)`: vincula convite a conta autenticada e marca `invite_used_at`.
- `get_current_patient()`: recupera paciente pela sessao autenticada.
- `update_current_patient_name(p_full_name)`: atualiza nome do paciente logado.

## Decisoes tecnicas

- Convite nao e mais credencial permanente; ele serve para vincular a conta.
- `?convite=` e o parametro principal, com suporte legado a `?token=`.
- `enviar-relatorio` e o endpoint principal, com fallback legado para `send-report`.
- `localStorage` segue como fonte primaria do paciente para uso offline.
- Supabase RLS passa a validar registros pelo `patients.user_id` autenticado.
- `CACHE_NAME` deve ser incrementado a cada deploy com mudancas em HTML/CSS/JS.

## Workflow Git

Workspace correto:

```text
C:\Users\Togszera\Desktop\RDP-Pro
```

Nao usar `C:\Users\Togszera\Documents\RDP-Pro`.

Branch base de trabalho: `develop`.

Sempre que houver criacao ou alteracao de arquivos neste projeto, inclusive em chats futuros, seguir obrigatoriamente:

1. `senior-dev`: implementa qualquer ajuste, melhoria, bugfix, ideia nova ou funcionalidade.
2. `code-reviewer`: revisa minuciosamente as alteracoes, aponta riscos e corrige o que for necessario.
3. `qa-senior`: faz analise de impacto e define casos de teste, incluindo regressivos quando algo existente foi alterado.
4. `qa-automate`: cria ou ajusta testes automatizados definidos pelo `qa-senior`.
5. Validar testes automatizados e revisar diff.
6. `git status`
7. Fazer staging apenas dos arquivos revisados e pertencentes ao escopo com `git add -- <arquivos>`.
8. Rodar `git diff --cached`.
9. `git commit`
10. `git push origin develop`
11. Abrir PR `develop -> main` para aprovacao, ou atualizar/comentar o PR existente se ele ja existir.

Se algum desses passos falhar por permissao, credencial, conflito ou ambiente, informar o bloqueio claramente.

Nunca fazer push direto para `main`.

Se algum agent formal nao estiver disponivel na sessao, executar a etapa como papel explicito no proprio Codex e registrar no resumo final. Quando houver ferramenta de subagents disponivel, usar subagents com esses papeis no prompt.

## Testes e Browser

No PowerShell, evitar `npm test` porque `npm.ps1` pode ser bloqueado pela ExecutionPolicy. Usar:

```powershell
.\test.cmd
npm.cmd test
```

Para evitar recorrencia de `ERR_BLOCKED_BY_CLIENT`, nao usar Browser para `file://`, `localhost` ou `127.0.0.1`, salvo pedido explicito do usuario. Se o usuario pedir Browser e bloquear, parar imediatamente e substituir por testes automatizados/estaticos que cubram o comportamento ou estilo alterado.
