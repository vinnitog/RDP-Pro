# RDP Pro

PWA de Registro de Pensamentos para TCC — versão profissional B2B.

## Arquitetura

```
rdp-pro/
├── index.html              # App do paciente (PWA)
├── therapist.html          # Painel do psicólogo
├── manifest.json
├── sw.js                   # Service Worker
├── css/
│   ├── app.css             # Estilos do paciente
│   └── therapist.css       # Estilos do painel
├── js/
│   ├── config.js           # Configuração centralizada (prod/dev)
│   ├── db.js               # Camada de dados (Supabase + localStorage)
│   ├── app.js              # Lógica do app do paciente
│   └── therapist.js        # Lógica do painel do psicólogo
├── icons/
│   ├── icon-192.png        # (copiar do RDP original)
│   └── icon-512.png        # (copiar do RDP original)
└── supabase/
    ├── migrations/
    │   └── 001_initial_schema.sql
    └── functions/
        └── send-report/
            └── index.ts    # Edge Function de envio de e-mail
```

## Setup — passo a passo

### 1. Banco de dados (Supabase)

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Abra o projeto de **produção**
3. Vá em **SQL Editor** e execute o conteúdo de `supabase/migrations/001_initial_schema.sql`
4. Repita para o projeto de **teste** (banco separado)

### 2. Edge Function (envio de e-mail)

#### Instalar Supabase CLI
```bash
npm install -g supabase
supabase login
```

#### Configurar variáveis de ambiente na Edge Function
No dashboard Supabase → **Edge Functions** → **Secrets**, adicione:
- `RESEND_API_KEY` — sua chave da [Resend](https://resend.com) (gratuito até 3k emails/mês)

#### Deploy da função
```bash
supabase functions deploy send-report --project-ref ofojfewdeamfackofjgt
```

#### Domínio de e-mail (Resend)
Por ora, use o domínio de teste da Resend. Para produção, configure um domínio próprio em resend.com/domains.
Em modo de teste, o `from` pode ser `onboarding@resend.dev` — altere em `send-report/index.ts`.

### 3. App (GitHub Pages)

```bash
# Criar repositório no GitHub e fazer push
git init
git add .
git commit -m "RDP Pro v1.0"
git remote add origin https://github.com/SEU_USUARIO/rdp-pro.git
git push -u origin main
```

Ativar GitHub Pages: Settings → Pages → Branch: main → / (root)

A URL do painel do psicólogo será: `https://SEU_USUARIO.github.io/rdp-pro/therapist.html`

### 4. Modo dev/teste

Em `js/config.js`, mude `IS_DEV = true` para:
- Usar o banco de teste (configure um segundo projeto no Supabase e troque a URL/key)
- Redirecionar e-mails de relatório para `vinnitog@gmail.com`

## Fluxo de uso

### Psicólogo
1. Acessa `therapist.html` e cria conta
2. Clica em **+ Novo convite** (pode informar o nome do paciente)
3. Copia o link gerado e envia para o paciente (WhatsApp, e-mail, etc.)
4. Em **Configurações**, define e-mail de recebimento e limite de dias

### Paciente
1. Abre o link de convite no celular
2. Faz o onboarding (informa seu nome)
3. Usa o app normalmente
4. Quando o ciclo se completa, toca em **📧 Enviar Relatório**
   - O relatório vai direto para o e-mail do psicólogo
5. Limpa o histórico e começa novo ciclo

## Integração de pagamentos (preparado para)

O campo `plan` na tabela `therapists` aceita `'free'` e `'pro'`.
A seção de configurações já tem o espaço reservado para Stripe/PagSeguro.
Quando implementar: criar uma Edge Function `create-checkout` que gera
uma sessão Stripe e redireciona para o checkout.

## Variáveis de ambiente necessárias (Supabase Secrets)

| Variável | Descrição |
|----------|-----------|
| `RESEND_API_KEY` | Chave da API Resend para envio de e-mails |
| `SUPABASE_URL` | Injetada automaticamente |
| `SUPABASE_SERVICE_ROLE_KEY` | Injetada automaticamente |

## Incrementar versão do Service Worker

A cada deploy com mudanças em HTML/CSS/JS, atualize em `sw.js`:
```js
const CACHE_NAME = 'rdp-pro-v1.1'; // ← incrementar aqui
```
