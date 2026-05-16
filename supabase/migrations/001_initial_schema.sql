-- RDP Pro — Schema inicial
-- Executar no Supabase SQL Editor (produção E teste separadamente)

-- ─── EXTENSÕES ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── TABELAS ──────────────────────────────────────────────────────────────────

-- Psicólogos (vinculados ao auth.users do Supabase)
create table if not exists public.therapists (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  crp         text,                          -- ex: "06/123456"
  email       text not null,
  clinic_name text,
  logo_url    text,
  plan        text not null default 'free',  -- 'free' | 'pro' (para Stripe futuramente)
  settings    jsonb not null default '{
    "cycle_days": 10,
    "report_email": null,
    "primary_color": "#6b7c4a"
  }'::jsonb,
  created_at  timestamptz not null default now()
);

-- Pacientes (vinculados a um psicólogo)
create table if not exists public.patients (
  id           uuid primary key default uuid_generate_v4(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  invite_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  full_name    text,                          -- preenchido pelo paciente no onboarding
  email        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

-- Registros TCC
create table if not exists public.records (
  id            uuid primary key default uuid_generate_v4(),
  patient_id    uuid not null references public.patients(id) on delete cascade,
  therapist_id  uuid not null references public.therapists(id) on delete cascade,
  datetime      text not null,
  date_key      text not null,
  situation     text,
  thought       text,
  feeling       text,
  anxiety1      integer not null default 0 check (anxiety1 between 0 and 10),
  reaction      text,
  alt_thought   text,
  anxiety2      integer not null default 0 check (anxiety2 between 0 and 10),
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

alter table public.therapists enable row level security;
alter table public.patients   enable row level security;
alter table public.records    enable row level security;

-- Psicólogo só vê/edita os próprios dados
create policy "therapist_self" on public.therapists
  for all using (auth.uid() = id);

-- Psicólogo gerencia seus pacientes
create policy "therapist_patients" on public.patients
  for all using (auth.uid() = therapist_id);

-- Paciente insere registro via token (anon, sem auth)
-- O therapist_id e patient_id são validados pela Edge Function
create policy "anon_insert_records" on public.records
  for insert with check (true);

-- Psicólogo lê registros dos próprios pacientes
create policy "therapist_read_records" on public.records
  for select using (auth.uid() = therapist_id);

-- Paciente lê os próprios registros (sem auth, via patient_id — controlado no client)
create policy "patient_read_own_records" on public.records
  for select using (true);

-- ─── FUNÇÃO: validar token de convite ─────────────────────────────────────────
-- Usada pelo app do paciente para se identificar sem criar conta
create or replace function public.get_patient_by_token(p_token text)
returns table (
  patient_id    uuid,
  therapist_id  uuid,
  therapist_name text,
  clinic_name   text,
  settings      jsonb
)
language plpgsql security definer as $$
begin
  return query
    select
      pt.id,
      pt.therapist_id,
      t.full_name,
      t.clinic_name,
      t.settings
    from public.patients pt
    join public.therapists t on t.id = pt.therapist_id
    where pt.invite_token = p_token
      and pt.active = true;
end;
$$;

-- ─── ÍNDICES ──────────────────────────────────────────────────────────────────
create index if not exists idx_records_patient    on public.records(patient_id);
create index if not exists idx_records_therapist  on public.records(therapist_id);
create index if not exists idx_patients_token     on public.patients(invite_token);
create index if not exists idx_patients_therapist on public.patients(therapist_id);
