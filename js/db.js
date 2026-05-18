// RDP Pro — Camada de dados
// Estratégia: localStorage como fonte primária (offline-first),
// Supabase como sincronização quando online.

const DB = (() => {
  let _supabase = null;

  function client() {
    if (!_supabase) {
      const { createClient } = window.supabase;
      _supabase = createClient(
        window.RDP_CONFIG.supabase.url,
        window.RDP_CONFIG.supabase.anonKey
      );
    }
    return _supabase;
  }

  // ─── LOCAL STORAGE HELPERS ──────────────────────────────────────────────────
  const LS = {
    get: (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
    rm:  (key) => localStorage.removeItem(key),
  };

  // Gera UUID v4 compatível com PostgreSQL uuid primary key
  function generateUUID() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    // Fallback para navegadores sem crypto.randomUUID
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // ─── SESSION DO PACIENTE ────────────────────────────────────────────────────
  const Patient = {
    save(data) { LS.set("rdp_patient_session", data); },
    get() { return LS.get("rdp_patient_session"); },
    clear() { LS.rm("rdp_patient_session"); },
    savePendingInvite(token) { LS.set("rdp_pending_invite_token", token); },
    getPendingInvite() { return LS.get("rdp_pending_invite_token"); },
    clearPendingInvite() { LS.rm("rdp_pending_invite_token"); },

    async getAuthSession() {
      const { data } = await client().auth.getSession();
      return data.session;
    },

    async signUp({ email, password, fullName }) {
      const { data, error } = await client().auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "patient",
            full_name: fullName || null,
          },
        },
      });
      if (error) throw error;
      return data;
    },

    async signIn({ email, password }) {
      const { data, error } = await client().auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    async signOut() {
      await client().auth.signOut();
      Patient.clear();
      Patient.clearPendingInvite();
    },

    async resolveToken(token) {
      const cached = Patient.get();
      if (cached?.invite_token === token) return cached;

      const { data, error } = await client()
        .rpc("get_patient_by_token", { p_token: token })
        .single();

      if (error || !data) throw new Error("Token inválido ou expirado");

      const session = { ...data, invite_token: token };
      Patient.save(session);
      return session;
    },

    async claimInvite(token, fullName = null) {
      const { data, error } = await client()
        .rpc("claim_patient_invite", { p_token: token, p_full_name: fullName })
        .single();

      if (error || !data) throw new Error(error?.message || "Convite inválido");

      const session = { ...data, invite_token: token };
      Patient.save(session);
      Patient.clearPendingInvite();
      return session;
    },

    async resolveAuthSession() {
      const session = await Patient.getAuthSession();
      if (!session) return null;

      const { data, error } = await client()
        .rpc("get_current_patient")
        .single();

      if (error || !data) return null;

      Patient.save(data);
      return data;
    },

    async updateName(name) {
      const session = await Patient.getAuthSession();
      if (!session) return;

      const { error } = await client()
        .rpc("update_current_patient_name", { p_full_name: name });
      if (error) throw error;
    },
  };

  // ─── REGISTROS ──────────────────────────────────────────────────────────────
  const Records = {
    _key: () => {
      const s = Patient.get();
      return s ? `rdp_records_${s.patient_id}` : "rdp_records_anon";
    },

    getAll() {
      return LS.get(Records._key()) || [];
    },

    save(records) {
      LS.set(Records._key(), records);
    },

    add(record) {
      const all = Records.getAll();
      // UUID real — o banco exige uuid, Date.now() era rejeitado com 400
      const newRecord = { ...record, id: generateUUID(), synced: false };
      all.unshift(newRecord);
      Records.save(all);
      Records.syncPending().catch(console.warn);
      return newRecord;
    },

    update(id, data) {
      const all = Records.getAll();
      const idx = all.findIndex((r) => r.id === id);
      if (idx === -1) return;
      all[idx] = { ...all[idx], ...data, synced: false };
      Records.save(all);
      Records.syncPending().catch(console.warn);
    },

    delete(id) {
      const all = Records.getAll().filter((r) => r.id !== id);
      Records.save(all);
    },

    countDays() {
      return new Set(Records.getAll().map((r) => r.date_key)).size;
    },

    async syncPending() {
      const session = Patient.get();
      if (!session) return;

      const all = Records.getAll();
      const pending = all.filter((r) => !r.synced);
      if (!pending.length) return;

      for (const r of pending) {
        const { error } = await client()
          .from("records")
          .upsert({
            id:           r.id,   // já é UUID válido
            patient_id:   session.patient_id,
            therapist_id: session.therapist_id,
            datetime:     r.datetime,
            date_key:     r.date_key,
            situation:    r.situation,
            thought:      r.thought,
            feeling:      r.feeling,
            anxiety1:     r.anxiety1,
            reaction:     r.reaction,
            alt_thought:  r.altThought || r.alt_thought,
            anxiety2:     r.anxiety2,
          }, { onConflict: "id" });

        if (!error) {
          const idx = all.findIndex((x) => x.id === r.id);
          if (idx !== -1) all[idx].synced = true;
        }
      }
      Records.save(all);
    },

    clearAll() {
      Records.save([]);
    },
  };

  // ─── AUTH DO PSICÓLOGO ──────────────────────────────────────────────────────
  const Auth = {
    async signUp({ email, password, fullName, crp, clinicName }) {
      const { data, error } = await client().auth.signUp({
        email,
        password,
        options: {
          data: {
            role:        "therapist",
            full_name:   fullName,
            crp:         crp || null,
            clinic_name: clinicName || null,
          },
        },
      });
      if (error) throw error;
      return data;
    },

    async signIn({ email, password }) {
      const { data, error } = await client().auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    async signOut() {
      await client().auth.signOut();
    },

    async getSession() {
      const { data } = await client().auth.getSession();
      return data.session;
    },

    async getProfile() {
      const session = await Auth.getSession();
      if (!session) return null;
      if (session.user.user_metadata?.role === "patient") return null;

      const { data: rows, error: fetchError } = await client()
        .from("therapists")
        .select("*")
        .eq("id", session.user.id)
        .limit(1);

      if (fetchError) throw fetchError;
      if (rows && rows.length > 0) return rows[0];

      // Primeiro login após confirmar e-mail — cria perfil agora com sessão ativa
      const { data: refreshed } = await client().auth.refreshSession();
      const meta = refreshed?.session?.user?.user_metadata
        || session.user.user_metadata
        || {};

      const { data: created, error: createError } = await client()
        .from("therapists")
        .insert({
          id:          session.user.id,
          full_name:   meta.full_name   || session.user.email,
          crp:         meta.crp         || null,
          email:       session.user.email,
          clinic_name: meta.clinic_name || null,
          settings: {
            cycle_days:    10,
            report_email:  session.user.email,
            primary_color: "#6b7c4a",
          },
        })
        .select()
        .single();

      if (createError) throw createError;
      return created;
    },

    onAuthChange(cb) {
      client().auth.onAuthStateChange(cb);
    },
  };

  // ─── PAINEL DO PSICÓLOGO ────────────────────────────────────────────────────
  const Therapist = {
    async getPatients() {
      const session = await Auth.getSession();
      if (!session) return [];
      const { data } = await client()
        .from("patients")
        .select("*, records(count)")
        .eq("therapist_id", session.user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },

    async createPatient(name) {
      const session = await Auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const { data, error } = await client()
        .from("patients")
        .insert({ therapist_id: session.user.id, full_name: name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async updateSettings(settings) {
      const session = await Auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const { error } = await client()
        .from("therapists")
        .update(settings)
        .eq("id", session.user.id);
      if (error) throw error;
    },

    async getPatientRecords(patientId) {
      const { data } = await client()
        .from("records")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      return data || [];
    },

    async togglePatient(patientId, active) {
      const { error } = await client()
        .from("patients")
        .update({ active })
        .eq("id", patientId);
      if (error) throw error;
    },
  };

  // ─── ENVIO DE RELATÓRIO ─────────────────────────────────────────────────────
  const Report = {
    async send(records) {
      const session = Patient.get();
      if (!session) throw new Error("Sessão não encontrada");

      const request = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${window.RDP_CONFIG.supabase.anonKey}`,
          },
          body: JSON.stringify({
            patient_id:        session.patient_id,
            invite_token:      session.invite_token,
            records,
            patient_name:      session.patient_name || "Paciente",
            // Offset do fuso horário do cliente em minutos (ex: -180 para BRT)
            // A Edge Function usa isso para formatar o timestamp corretamente
            timezone_offset:   new Date().getTimezoneOffset(),
          }),
        };

      let res = await fetch(
        `${window.RDP_CONFIG.supabase.url}/functions/v1/enviar-relatorio`,
        request
      );

      if (res.status === 404) {
        res = await fetch(
          `${window.RDP_CONFIG.supabase.url}/functions/v1/send-report`,
          request
        );
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no envio");
      return data;
    },
  };

  return { Patient, Records, Auth, Therapist, Report, client };
})();

window.DB = DB;
