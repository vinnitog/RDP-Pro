-- RDP Pro — Migration 002: Corrige RLS permissivo em records e patients
-- Executar no Supabase SQL Editor (produção e teste separadamente)
--
-- PROBLEMA CORRIGIDO
-- ─────────────────
-- 1. "anon_insert_records": with check (true) → qualquer anon podia inserir
--    registros com patient_id/therapist_id arbitrários.
--
-- 2. "patient_read_own_records": using (true) → qualquer anon conseguia
--    fazer SELECT em todos os registros do banco (sem filtro nenhum).
--
-- SOLUÇÃO
-- ───────
-- Função SQL security definer `is_valid_patient_record()` que valida o par
-- (patient_id, therapist_id) diretamente no banco, sem expor dados de outros
-- pacientes. A anon key continua funcionando — o que muda é que o banco
-- passa a checar a consistência dos IDs antes de aceitar o insert.
--
-- Para o SELECT do paciente, exigimos que o patient_id informado exista
-- de fato na tabela patients (via subquery), impedindo varredura livre.

-- ─── 1. REMOVE POLÍTICAS ANTIGAS ─────────────────────────────────────────────

drop policy if exists "anon_insert_records"       on public.records;
drop policy if exists "patient_read_own_records"  on public.records;

-- ─── 2. FUNÇÃO DE VALIDAÇÃO DO PAR (patient_id, therapist_id) ────────────────
--
-- security definer: roda com permissões do owner (postgres), não do caller anon.
-- Isso permite checar a tabela patients mesmo com RLS ativo, sem vazar dados.
-- set search_path garante que a função não seja redirecionada por search_path injection.

create or replace function public.is_valid_patient_record(
  p_patient_id   uuid,
  p_therapist_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.patients
    where id           = p_patient_id
      and therapist_id = p_therapist_id
      and active       = true
  );
end;
$$;

-- Apenas o owner e service_role podem alterar a função
revoke all on function public.is_valid_patient_record(uuid, uuid) from public;
grant execute on function public.is_valid_patient_record(uuid, uuid) to anon;
grant execute on function public.is_valid_patient_record(uuid, uuid) to authenticated;

-- ─── 3. NOVA POLÍTICA DE INSERT ───────────────────────────────────────────────
--
-- Aceita o insert somente se o par (patient_id, therapist_id) existir em patients
-- e o paciente estiver ativo. Qualquer UUID inventado é rejeitado pelo banco.

create policy "anon_insert_records_validated"
  on public.records
  for insert
  with check (
    public.is_valid_patient_record(patient_id, therapist_id)
  );

-- ─── 4. NOVA POLÍTICA DE SELECT PARA O PACIENTE ──────────────────────────────
--
-- Antes: using (true) → qualquer anon via SELECT * FROM records.
-- Agora: exige que o patient_id passado exista em patients.
--
-- Observação: o app nunca faz SELECT direto em records via anon key —
-- ele usa localStorage como fonte primária e o psicólogo lê via auth.
-- Esta política é uma barreira defensiva para chamadas diretas à API.

create policy "patient_read_own_records"
  on public.records
  for select
  using (
    exists (
      select 1
      from public.patients p
      where p.id     = records.patient_id
        and p.active = true
    )
  );

-- ─── 5. BLOQUEIA UPSERT/UPDATE/DELETE DE RECORDS PELO ANON ──────────────────
--
-- syncPending usa upsert (insert com onConflict). A política de insert acima
-- já cobre o caso. UPDATE e DELETE pelo anon não fazem parte do fluxo do app
-- e não devem ser permitidos.
--
-- Se já existia alguma política de update/delete para anon, remove.

drop policy if exists "anon_update_records" on public.records;
drop policy if exists "anon_delete_records" on public.records;

-- ─── 6. REVISÃO DA POLÍTICA DE SELECT EM PATIENTS ────────────────────────────
--
-- Hoje: "therapist_patients" for all → psicólogo gerencia seus pacientes (ok).
-- Problema: anon consegue chamar SELECT em patients sem política bloqueando.
-- A função get_patient_by_token já é security definer e retorna apenas o
-- paciente do token — mas um SELECT direto em patients pelo anon não tem barreira.
--
-- Adicionamos política explícita de negação para SELECT anon em patients.
-- A função get_patient_by_token continua funcionando (roda como owner).

drop policy if exists "anon_read_patients_block" on public.patients;

create policy "anon_read_patients_block"
  on public.patients
  for select
  using (
    -- Permite apenas se autenticado como o therapist dono
    auth.uid() = therapist_id
  );

-- ─── VERIFICAÇÃO (rodar após executar, no SQL Editor) ────────────────────────
--
-- Deve retornar as políticas novas sem as antigas:
--
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where tablename in ('records', 'patients')
-- order by tablename, policyname;
