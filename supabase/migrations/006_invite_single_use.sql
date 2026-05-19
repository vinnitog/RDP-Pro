-- RDP Pro - Migration 006: convites de uso unico
-- Execute depois da 005 em producao e teste.

alter table public.patients
  add column if not exists invite_used_at timestamptz;

create index if not exists idx_patients_invite_used_at
  on public.patients(invite_used_at);

-- Convites ja vinculados antes desta migration passam a ser considerados usados.
update public.patients
   set invite_used_at = coalesce(invite_used_at, last_seen_at, created_at)
 where user_id is not null
   and invite_used_at is null;

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
      and pt.active = true
      and pt.invite_used_at is null;
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
    raise exception 'Paciente nao autenticado';
  end if;

  select *
    into v_patient
    from public.patients p
    where p.invite_token = p_token
      and p.active = true
      and p.invite_used_at is null
    for update;

  if not found then
    raise exception 'Convite invalido ou expirado';
  end if;

  if v_patient.user_id is not null and v_patient.user_id <> v_uid then
    raise exception 'Este convite ja esta vinculado a outra conta';
  end if;

  update public.patients
     set user_id = v_uid,
         email = coalesce(public.patients.email, v_email),
         full_name = coalesce(nullif(p_full_name, ''), public.patients.full_name, v_email),
         last_seen_at = now(),
         invite_used_at = now()
   where public.patients.id = v_patient.id;

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

revoke all on function public.get_patient_by_token(text) from public;
revoke all on function public.claim_patient_invite(text, text) from public;
grant execute on function public.get_patient_by_token(text) to anon;
grant execute on function public.get_patient_by_token(text) to authenticated;
grant execute on function public.claim_patient_invite(text, text) to authenticated;

notify pgrst, 'reload schema';
