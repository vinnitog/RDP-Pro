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
    |   `-- 003_patient_auth_ptbr_routes.sql
    `-- functions/
        |-- enviar-relatorio/
        `-- send-report/    # Compatibilidade com endpoint antigo
```

## Setup

### Banco de dados

1. Acesse o Supabase Dashboard.
2. Abra o projeto de producao.
3. No SQL Editor, execute as migrations em ordem: `001`, `002`, `003`.
4. Repita no projeto de teste, se houver.

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
3. Copia o link com `?convite=` e envia para o paciente.
4. Em **Configuracoes**, define e-mail de recebimento e limite de dias.

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
