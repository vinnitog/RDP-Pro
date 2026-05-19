// RDP Pro — Painel do Psicólogo

const Therapist = (() => {
  let profile = null;
  let dashboardPromise = null;
  let authEnterBound = false;

  function buildPatientInviteUrl(token) {
    const url = new URL("paciente.html", location.href);
    url.search = "";
    url.searchParams.set("convite", token);
    return url.toString();
  }

  async function init() {
    _bindAuthEnter();
    try {
      const session = await DB.Auth.getSession();
      if (!session) {
        showView("view-autenticacao");
        return;
      }
      await loadDashboardOnce();
    } catch (e) {
      showView("view-autenticacao");
      handleDashboardError(e);
    }
  }

  function _bindAuthEnter() {
    if (authEnterBound) return;
    authEnterBound = true;
    const onEnter = (fn) => (e) => { if (e.key === "Enter") fn(); };
    ["t-email", "t-password"].forEach((id) => {
      document.getElementById(id)?.addEventListener("keydown", onEnter(signIn));
    });
    ["signup-email", "signup-password", "signup-name"].forEach((id) => {
      document.getElementById(id)?.addEventListener("keydown", onEnter(signUp));
    });
  }

  DB.Auth.onAuthChange((event) => {
    if (event === "SIGNED_IN") {
      setTimeout(() => {
        loadDashboardOnce().catch(handleDashboardError);
      }, 0);
    }
    if (event === "SIGNED_OUT") {
      profile = null;
      showView("view-autenticacao");
      setLoading("btn-signin", false);
    }
  });

  // ─── VIEWS ───────────────────────────────────────────────────────────────
  function showView(id) {
    document.querySelectorAll(".t-view").forEach((v) => v.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");
  }

  // ─── AUTH ─────────────────────────────────────────────────────────────────
  async function signIn() {
    const email    = document.getElementById("t-email")?.value.trim();
    const password = document.getElementById("t-password")?.value;
    if (!email || !password) { showError("auth-error", "Preencha e-mail e senha"); return; }

    setLoading("btn-signin", true);
    try {
      await DB.Auth.signIn({ email, password });
    } catch (e) {
      showError("auth-error", "E-mail ou senha incorretos");
      setLoading("btn-signin", false);
      return;
    }

    try {
      await loadDashboardOnce();
    } catch (e) {
      handleDashboardError(e);
    } finally {
      setLoading("btn-signin", false);
    }
  }

  async function signUp() {
    const email     = document.getElementById("signup-email")?.value.trim();
    const password  = document.getElementById("signup-password")?.value;
    const fullName  = document.getElementById("signup-name")?.value.trim();
    const crp       = document.getElementById("signup-crp")?.value.trim();
    const clinicName= document.getElementById("signup-clinic")?.value.trim();

    if (!email || !password || !fullName) {
      showError("signup-error", "Nome, e-mail e senha são obrigatórios");
      return;
    }
    if (password.length < 6) {
      showError("signup-error", "Senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading("btn-signup", true);
    try {
      await DB.Auth.signUp({ email, password, fullName, crp, clinicName });
      showError("signup-error", "Conta criada! Verifique seu e-mail para confirmar.", "success");
    } catch (e) {
      showError("signup-error", e.message || "Erro ao criar conta");
    } finally {
      setLoading("btn-signup", false);
    }
  }

  async function signOut() {
    await DB.Auth.signOut();
    showView("view-autenticacao");
  }

  // ─── DASHBOARD ───────────────────────────────────────────────────────────
  async function loadDashboard() {
    profile = await DB.Auth.getProfile();
    if (!profile) { showView("view-autenticacao"); return; }

    showView("view-painel");
    renderProfile();
    await renderPatients();
  }

  function loadDashboardOnce() {
    if (!dashboardPromise) {
      dashboardPromise = loadDashboard().finally(() => {
        dashboardPromise = null;
      });
    }
    return dashboardPromise;
  }

  function handleDashboardError(e) {
    console.warn("Erro ao carregar painel:", e);
    showError("auth-error", "Login feito, mas nao foi possivel carregar o painel. Atualize a pagina.");
  }

  function renderProfile() {
    const el = document.getElementById("t-profile-name");
    if (el) el.textContent = profile.full_name || "Psicólogo(a)";
    const el2 = document.getElementById("t-profile-crp");
    if (el2) el2.textContent = profile.crp ? `CRP ${profile.crp}` : "";
    const el3 = document.getElementById("t-profile-clinic");
    if (el3) el3.textContent = profile.clinic_name || "";
  }

  // cache para filtragem client-side sem nova requisição
  let _patientsCache = [];

  async function renderPatients() {
    const inner = document.getElementById("patients-list-inner");
    if (!inner) return;

    inner.innerHTML = '<div class="t-loading">Carregando pacientes...</div>';
    _patientsCache = await DB.Therapist.getPatients();

    // limpa busca ao recarregar
    const searchEl = document.getElementById("patients-search");
    if (searchEl) searchEl.value = "";

    _renderPatientCards(_patientsCache, inner);
  }

  function filterPatients(query) {
    const inner = document.getElementById("patients-list-inner");
    if (!inner) return;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? _patientsCache.filter((p) =>
          (p.full_name || "").toLowerCase().includes(q)
        )
      : _patientsCache;
    _renderPatientCards(filtered, inner);
  }

  function _renderPatientCards(patients, container) {
    if (!patients.length) {
      container.innerHTML = `<div class="t-empty">
        <p>Nenhum paciente encontrado.</p>
        <p>Crie um convite para começar.</p>
      </div>`;
      return;
    }

    container.innerHTML = patients.map((p) => {
      const recordCount = p.records?.[0]?.count || 0;
      const lastSeen = p.last_seen_at
        ? new Date(p.last_seen_at).toLocaleDateString("pt-BR")
        : "Nunca acessou";
      const inviteUrl = buildPatientInviteUrl(p.invite_token);

      return `<div class="patient-card ${!p.active ? "inactive" : ""}">
        <div class="patient-info">
          <div class="patient-name">${esc(p.full_name || "Aguardando onboarding")}</div>
          <div class="patient-meta">
            <span>${recordCount} registro${recordCount !== 1 ? "s" : ""}</span>
            <span>${lastSeen}</span>
            ${!p.active ? '<span style="color:#c62828">Inativo</span>' : ""}
          </div>
        </div>
        <div class="patient-actions">
          <button class="t-btn t-btn-sm" onclick="Therapist.copyInvite('${inviteUrl}')">Copiar link</button>
          <button class="t-btn t-btn-sm" onclick="Therapist.viewRecords('${p.id}', '${esc(p.full_name || "Paciente")}')">Ver registros</button>
          <button class="t-btn t-btn-sm t-btn-danger" onclick="Therapist.togglePatient('${p.id}', ${!p.active})">
            ${p.active ? "Desativar" : "Ativar"}
          </button>
        </div>
      </div>`;
    }).join("");
  }

  // ─── CRIAR PACIENTE ───────────────────────────────────────────────────────
  async function createPatient() {
    const name = document.getElementById("new-patient-name")?.value.trim();
    setLoading("btn-create-patient", true);
    try {
      const patient = await DB.Therapist.createPatient(name || null);
      const inviteUrl = buildPatientInviteUrl(patient.invite_token);
      document.getElementById("new-patient-name").value = "";
      document.getElementById("invite-url-display").textContent = inviteUrl;
      document.getElementById("invite-result").style.display = "block";
      await renderPatients();
      showToast("Paciente criado! Copie o link de convite.");
    } catch (e) {
      showToast("Erro: " + e.message);
    } finally {
      setLoading("btn-create-patient", false);
    }
  }

  function copyInvite(url) {
    navigator.clipboard.writeText(url).then(() => showToast("Link copiado!"));
  }

  async function togglePatient(id, active) {
    try {
      await DB.Therapist.togglePatient(id, active);
      await renderPatients();
    } catch (e) {
      showToast("Erro: " + e.message);
    }
  }

  // ─── VER REGISTROS ────────────────────────────────────────────────────────
  async function viewRecords(patientId, patientName) {
    showView("view-registros-paciente");
    document.getElementById("pr-patient-name").textContent = patientName;
    document.getElementById("pr-records-area").innerHTML =
      '<div class="t-loading">Carregando...</div>';

    const records = await DB.Therapist.getPatientRecords(patientId);

    if (!records.length) {
      document.getElementById("pr-records-area").innerHTML =
        '<div class="t-empty">Nenhum registro ainda.</div>';
      return;
    }

    document.getElementById("pr-records-area").innerHTML = records.map((r) => `
      <div class="pr-record">
        <div class="pr-record-header">
          <span class="pr-date">${esc(r.datetime)}</span>
          <span class="pr-anx">Anx: ${r.anxiety1}/10 → ${r.anxiety2}/10</span>
        </div>
        ${r.situation ? `<div class="pr-field"><label>Situação</label><p>${esc(r.situation)}</p></div>` : ""}
        ${r.thought ? `<div class="pr-field"><label>Pensamento</label><p>${esc(r.thought)}</p></div>` : ""}
        ${r.feeling ? `<div class="pr-field"><label>Sentimento</label><p>${esc(r.feeling)}</p></div>` : ""}
        ${r.alt_thought ? `<div class="pr-field"><label>Pensamento Alternativo</label><p>${esc(r.alt_thought)}</p></div>` : ""}
      </div>`).join("");
  }

  // ─── SETTINGS ────────────────────────────────────────────────────────────
  function showSettings() {
    showView("view-configuracoes");
    if (!profile) return;
    document.getElementById("s-full-name").value  = profile.full_name || "";
    document.getElementById("s-crp").value        = profile.crp || "";
    document.getElementById("s-clinic").value     = profile.clinic_name || "";
    document.getElementById("s-report-email").value =
      profile.settings?.report_email || profile.email || "";
    document.getElementById("s-cycle-days").value =
      profile.settings?.cycle_days || 10;
  }

  async function saveSettings() {
    const fullName   = document.getElementById("s-full-name")?.value.trim();
    const crp        = document.getElementById("s-crp")?.value.trim();
    const clinicName = document.getElementById("s-clinic")?.value.trim();
    const reportEmail= document.getElementById("s-report-email")?.value.trim();
    const cycleDays  = parseInt(document.getElementById("s-cycle-days")?.value || "10");

    setLoading("btn-save-settings", true);
    try {
      await DB.Therapist.updateSettings({
        full_name:   fullName,
        crp:         crp || null,
        clinic_name: clinicName || null,
        settings: {
          ...profile.settings,
          report_email: reportEmail,
          cycle_days:   cycleDays,
        },
      });
      profile = await DB.Auth.getProfile();
      renderProfile();
      showToast("Configurações salvas!");
      showView("view-painel");
    } catch (e) {
      showToast("Erro: " + e.message);
    } finally {
      setLoading("btn-save-settings", false);
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  function esc(s) {
    return (s || "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function showError(id, msg, type = "error") {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = `t-msg t-msg-${type}`;
    el.style.display = "block";
  }

  function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.style.opacity = loading ? "0.6" : "1";
  }

  function showToast(msg) {
    const t = document.getElementById("t-toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2800);
  }

  return {
    init, signIn, signUp, signOut,
    createPatient, copyInvite, togglePatient,
    viewRecords, showSettings, saveSettings,
    showView, loadDashboard, filterPatients,
  };
})();

window.Therapist = Therapist;
document.addEventListener("DOMContentLoaded", Therapist.init);
