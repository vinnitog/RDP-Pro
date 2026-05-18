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

- `get_patient_by_token(p_token)`: valida convite e mostra contexto inicial.
- `claim_patient_invite(p_token, p_full_name)`: vincula convite a conta autenticada.
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

Sempre que houver criacao ou alteracao de arquivos neste projeto, inclusive em chats futuros, finalizar o trabalho com:

1. `git status`
2. `git add`
3. `git commit`
4. `git push`

Se algum desses passos falhar por permissao, credencial, conflito ou ambiente, informar o bloqueio claramente.
