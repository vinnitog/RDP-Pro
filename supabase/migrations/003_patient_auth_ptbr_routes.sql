-- RDP Pro — Migration 003: login do paciente e contratos em pt-BR
-- Executar no Supabase SQL Editor (produção e teste separadamente)

alter table public.patients
  add column if not exists user_id uuid unique references auth.users(id) on delete set null;

create index if not exists idx_patients_user_id on public.patients(user_id);

-- O convite continua existindo, mas passa a ser usado para vincular a conta.
create or replace function public.get_patient_by_token(p_token text)
returns table (
  patient_id     uuid,
  therapist_id   uuid,
  therapist_name text,
  clinic_name    text,
  settings       jsonb,
  patient_name   text,
  patient_email  text,
  invite_token   text,
  user_id        uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      pt.id,
      pt.therapist_id,
      t.full_name,
      t.clinic_name,
      t.settings,
      pt.full_name,
      pt.email,
      pt.invite_token,
      pt.user_id
    from public.patients pt
    join public.therapists t on t.id = pt.therapist_id
    where pt.invite_token = p_token
      and pt.active = true;
end;
$$;

create or replace function public.claim_patient_invite(
  p_token text,
  p_full_name text default null
)
returns table (
  patient_id     uuid,
  therapist_id   uuid,
  therapist_name text,
  clinic_name    text,
  settings       jsonb,
  patient_name   text,
  patient_email  text,
  invite_token   text,
  user_id        uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_patient public.patients%rowtype;
begin
  if v_uid is null then
    raise exception 'Paciente não autenticado';
  end if;

  select *
    into v_patient
    from public.patients
    where invite_token = p_token
      and active = true
    for update;

  if not found then
    raise exception 'Convite inválido ou expirado';
  end if;

  if v_patient.user_id is not null and v_patient.user_id <> v_uid then
    raise exception 'Este convite já está vinculado a outra conta';
  end if;

  update public.patients
     set user_id = v_uid,
         email = coalesce(email, v_email),
         full_name = coalesce(nullif(p_full_name, ''), full_name, v_email),
         last_seen_at = now()
   where id = v_patient.id;

  return query
    select
      pt.id,
      pt.therapist_id,
      t.full_name,
      t.clinic_name,
      t.settings,
      pt.full_name,
      pt.email,
      pt.invite_token,
      pt.user_id
    from public.patients pt
    join public.therapists t on t.id = pt.therapist_id
    where pt.id = v_patient.id;
end;
$$;

create or replace function public.get_current_patient()
returns table (
  patient_id     uuid,
  therapist_id   uuid,
  therapist_name text,
  clinic_name    text,
  settings       jsonb,
  patient_name   text,
  patient_email  text,
  invite_token   text,
  user_id        uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      pt.id,
      pt.therapist_id,
      t.full_name,
      t.clinic_name,
      t.settings,
      pt.full_name,
      pt.email,
      pt.invite_token,
      pt.user_id
    from public.patients pt
    join public.therapists t on t.id = pt.therapist_id
    where pt.user_id = auth.uid()
      and pt.active = true
    limit 1;
end;
$$;

create or replace function public.update_current_patient_name(p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Paciente não autenticado';
  end if;

  update public.patients
     set full_name = nullif(p_full_name, ''),
         last_seen_at = now()
   where user_id = auth.uid()
     and active = true;
end;
$$;

revoke all on function public.claim_patient_invite(text, text) from public;
revoke all on function public.get_current_patient() from public;
revoke all on function public.update_current_patient_name(text) from public;
grant execute on function public.claim_patient_invite(text, text) to authenticated;
grant execute on function public.get_current_patient() to authenticated;
grant execute on function public.update_current_patient_name(text) to authenticated;

drop policy if exists "anon_insert_records_validated" on public.records;
drop policy if exists "patient_read_own_records" on public.records;
drop policy if exists "patient_insert_own_records" on public.records;
drop policy if exists "patient_update_own_records" on public.records;
drop policy if exists "patient_read_self" on public.patients;

create policy "patient_read_self"
  on public.patients
  for select
  using (auth.uid() = user_id);

create policy "patient_read_own_records"
  on public.records
  for select
  using (
    exists (
      select 1
      from public.patients p
      where p.id = records.patient_id
        and p.user_id = auth.uid()
        and p.active = true
    )
  );

create policy "patient_insert_own_records"
  on public.records
  for insert
  with check (
    exists (
      select 1
      from public.patients p
      where p.id = records.patient_id
        and p.therapist_id = records.therapist_id
        and p.user_id = auth.uid()
        and p.active = true
    )
  );

create policy "patient_update_own_records"
  on public.records
  for update
  using (
    exists (
      select 1
      from public.patients p
      where p.id = records.patient_id
        and p.user_id = auth.uid()
        and p.active = true
    )
  )
  with check (
    exists (
      select 1
      from public.patients p
      where p.id = records.patient_id
        and p.therapist_id = records.therapist_id
        and p.user_id = auth.uid()
        and p.active = true
    )
  );
