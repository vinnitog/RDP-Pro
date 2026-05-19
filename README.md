# RDP Pro

PWA de Registro de Pensamentos para TCC, versao profissional B2B.

## Arquitetura

```
rdp-pro/
|-- paciente.html           # App do paciente (PWA)
|-- psicologo.html          # Painel do psicologo
|-- index.html              # Compatibilidade com links antigos
|-- therapist.html          # Compatibilidade com links antigos
|-- manifest.json
|-- sw.js                   # Service Worker
|-- css/
|-- js/
|-- icons/
`-- supabase/
    |-- migrations/
    |   |-- 001_initial_schema.sql
    |   |-- 002_fix_rls_security.sql
    |   |-- 003_patient_auth_ptbr_routes.sql
    |   `-- 006_invite_single_use.sql
    |-- templates/
    |   |-- confirm-signup.html
    |   `-- confirm-signup-subject.txt
    `-- functions/
        |-- enviar-relatorio/
        `-- send-report/    # Compatibilidade com endpoint antigo
```

## Setup

### Banco de dados

1. Acesse o Supabase Dashboard.
2. Abra o projeto de producao.
3. No SQL Editor, execute as migrations em ordem: `001`, `002`, `003`.
4. Se o paciente receber erro `PGRST202` em `claim_patient_invite`, execute tambem a `004_repair_patient_auth_rpc.sql` no SQL Editor para recriar as RPCs e recarregar o schema do Supabase.
5. Se, depois disso, aparecer `column reference "invite_token" is ambiguous`, execute a `005_fix_claim_patient_invite_ambiguity.sql`.
6. Execute a `006_invite_single_use.sql` para invalidar convites apos o primeiro vinculo de conta.
7. Repita no projeto de teste, se houver.

### Edge Function

Configure o secret:

```bash
RESEND_API_KEY
```

Deploy do endpoint em pt-BR:

```bash
supabase functions deploy enviar-relatorio --project-ref ofojfewdeamfackofjgt
```

O endpoint antigo `send-report` foi mantido apenas como compatibilidade.

### Auth URLs

No Supabase Auth, configure:

```text
Site URL: https://SEU_USUARIO.github.io/RDP-Pro/paciente.html
Redirect URLs:
https://SEU_USUARIO.github.io/RDP-Pro/paciente.html
https://SEU_USUARIO.github.io/RDP-Pro/psicologo.html
https://SEU_USUARIO.github.io/RDP-Pro/**
```

O app tambem envia `emailRedirectTo` no cadastro para reforcar as rotas pt-BR.

### Auth Email Template

No Supabase Dashboard, acesse Authentication > Email Templates > Confirm signup.

Use:

```text
Subject: supabase/templates/confirm-signup-subject.txt
Body: supabase/templates/confirm-signup.html
```

O template usa `{{ .ConfirmationURL }}` e `{{ .Email }}`, variaveis oficiais do Supabase Auth.

### GitHub Pages

A rota principal do paciente e:

```text
https://SEU_USUARIO.github.io/rdp-pro/paciente.html
```

A rota principal do profissional e:

```text
https://SEU_USUARIO.github.io/rdp-pro/psicologo.html
```

## Fluxo de uso

### Psicologo

1. Acessa `psicologo.html` e cria conta.
2. Clica em **+ Novo convite**.
3. Envia o link com `?convite=` para o paciente.
4. Usa **Gerar novo link** quando precisar invalidar o link anterior e criar outro.
5. Em **Configuracoes**, define e-mail de recebimento e limite de dias.

### Paciente

1. Abre o link de convite no celular.
2. Cria conta ou entra com e-mail e senha para vincular o convite.
3. Faz o onboarding, se ainda faltar nome.
4. Usa o app normalmente.
5. Quando o ciclo se completa, toca em **Enviar Relatorio**.
6. Limpa o historico e comeca novo ciclo.

## Rotas e Endpoints

- `paciente.html?convite=<token>`: convite principal do paciente.
- `psicologo.html`: painel do profissional.
- `functions/v1/enviar-relatorio`: Edge Function principal.
- `index.html`, `therapist.html`, `?token=` e `send-report`: mantidos para compatibilidade.

## Service Worker

A cada deploy com mudancas em HTML/CSS/JS, incremente `CACHE_NAME` em `sw.js`.

## Testes

```bash
npm test
```

No Windows PowerShell, se `npm` for bloqueado pela policy local, use:

```bash
npm.cmd test
```
