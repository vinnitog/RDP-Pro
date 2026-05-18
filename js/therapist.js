// RDP Pro — Painel do Psicólogo

const Therapist = (() => {
  let profile = null;

  // Monta a base URL do app de forma robusta, independente do subdiretório do GitHub Pages.
  // Ex: https://vinnitog.github.io/RDP-Pro/therapist.html → https://vinnitog.github.io/RDP-Pro/
  function getBaseUrl() {
    const path = location.pathname; // /RDP-Pro/therapist.html
    const dir = path.substring(0, path.lastIndexOf("/") + 1); // /RDP-Pro/
    return `${location.origin}${dir}`;
  }

  async function init() {
    const session = await DB.Auth.getSession();
    setHeaderVisible(!!session);
    if (!session) {
      showView("view-auth");
      return;
    }
    await loadDashboard();
  }

  DB.Auth.onAuthChange(async (event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      if (session && !profile) {
        setHeaderVisible(true);
        await loadDashboard();
      }
      return;
    }
    if (event === "SIGNED_OUT") {
      const wasLoggedIn = !!profile;
      profile = null;
      setHeaderVisible(false);
      if (wasLoggedIn) showSessionExpiredBanner();
      showView("view-auth");
    }
  });

  // ─── VIEWS ───────────────────────────────────────────────────────────────
  function showView(id) {
    document.querySelectorAll(".t-view").forEach((v) => v.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");
  }

  function setHeaderVisible(visible) {
    const header = document.querySelector(".t-header");
    if (header) header.style.display = visible ? "" : "none";
  }

  function showSessionExpiredBanner() {
    if (document.getElementById("session-expired-banner")) return;
    const banner = document.createElement("div");
    banner.id = "session-expired-banner";
    banner.style.cssText = `
      background:#fff8e6;border:1px solid #f0c040;border-radius:10px;
      padding:10px 14px;font-size:0.84rem;color:#7a6010;
      margin-bottom:16px;text-align:center;
    `;
    banner.textContent = "⏱️ Sua sessão expirou. Faça login novamente para continuar.";
    const loginSection = document.getElementById("auth-login");
    if (loginSection) loginSection.insertBefore(banner, loginSection.firstChild);
  }

  function clearSessionExpiredBanner() {
    document.getElementById("session-expired-banner")?.remove();
  }

  // ─── TRADUÇÃO DE ERROS DO SUPABASE ────────────────────────────────────────
  function translateAuthError(message) {
    const m = (message || "").toLowerCase();
    if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
      return "E-mail ou senha incorretos. Tente novamente.";
    if (m.includes("email not confirmed") || m.includes("email address not confirmed"))
      return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
    if (m.includes("unable to validate email") || m.includes("invalid format"))
      return "O e-mail informado não é válido. Verifique e tente novamente.";
    if (m.includes("user already registered") || m.includes("already been registered"))
      return "Este e-mail já está cadastrado. Tente entrar ou recupere sua senha.";
    if (m.includes("password should be at least"))
      return "A senha deve ter pelo menos 6 caracteres.";
    if (m.includes("rate limit") || m.includes("too many requests"))
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    if (m.includes("network") || m.includes("fetch"))
      return "Sem conexão com a internet. Verifique sua rede e tente novamente.";
    return "Ocorreu um erro inesperado. Tente novamente.";
  }

  // ─── AUTH ─────────────────────────────────────────────────────────────────
  async function signIn() {
    const email    = document.getElementById("t-email")?.value.trim();
    const password = document.getElementById("t-password")?.value;
    if (!email || !password) { showError("auth-error", "Preencha e-mail e senha para continuar."); return; }

    setLoading("btn-signin", true);
    clearError("auth-error");
    clearSessionExpiredBanner();
    try {
      await DB.Auth.signIn({ email, password });
      await loadDashboard();
    } catch (e) {
      showError("auth-error", translateAuthError(e.message));
    } finally {
      setLoading("btn-signin", false);
    }
  }

  async function signUp() {
    const email      = document.getElementById("signup-email")?.value.trim();
    const password   = document.getElementById("signup-password")?.value;
    const fullName   = document.getElementById("signup-name")?.value.trim();
    const crp        = document.getElementById("signup-crp")?.value.trim();
    const clinicName = document.getElementById("signup-clinic")?.value.trim();

    if (!fullName) { showError("signup-error", "Informe seu nome completo."); return; }
    if (!email)    { showError("signup-error", "Informe seu e-mail."); return; }
    if (!password) { showError("signup-error", "Crie uma senha para sua conta."); return; }
    if (password.length < 6) { showError("signup-error", "A senha deve ter pelo menos 6 caracteres."); return; }

    setLoading("btn-signup", true);
    clearError("signup-error");
    try {
      await DB.Auth.signUp({ email, password, fullName, crp, clinicName });
      showError("signup-error", "✅ Conta criada com sucesso! Enviamos um e-mail de confirmação — clique no link para ativar sua conta.", "success");
    } catch (e) {
      showError("signup-error", translateAuthError(e.message));
    } finally {
      setLoading("btn-signup", false);
    }
  }

  async function signOut() {
    try { await DB.Auth.signOut(); } catch {}
    profile = null;
    setHeaderVisible(false);
    showView("view-auth");
  }

  // ─── DASHBOARD ───────────────────────────────────────────────────────────
  async function loadDashboard() {
    try {
      profile = await DB.Auth.getProfile();
    } catch (e) {
      showError("auth-error", "Não foi possível carregar seu perfil. Tente fazer login novamente.");
      setHeaderVisible(false);
      showView("view-auth");
      return;
    }

    if (!profile) {
      setHeaderVisible(false);
      showView("view-auth");
      return;
    }

    setHeaderVisible(true);
    showView("view-dashboard");
    renderProfile();
    await renderPatients();
  }

  function renderProfile() {
    const el = document.getElementById("t-profile-name");
    if (el) el.textContent = profile.full_name || "Psicólogo(a)";
    const el2 = document.getElementById("t-profile-crp");
    if (el2) el2.textContent = profile.crp ? `CRP ${profile.crp}` : "";
    const el3 = document.getElementById("t-profile-clinic");
    if (el3) el3.textContent = profile.clinic_name || "";
  }

  async function renderPatients() {
    const list = document.getElementById("patients-list");
    if (!list) return;

    list.innerHTML = '<div class="t-loading">Carregando pacientes...</div>';
    const patients = await DB.Therapist.getPatients();

    if (!patients.length) {
      list.innerHTML = `<div class="t-empty">
        <p>Nenhum paciente ainda.</p>
        <p>Crie um convite para começar.</p>
      </div>`;
      return;
    }

    list.innerHTML = patients.map((p) => {
      const recordCount = p.records?.[0]?.count || 0;
      const lastSeen = p.last_seen_at
        ? new Date(p.last_seen_at).toLocaleDateString("pt-BR")
        : "Nunca acessou";
      const inviteUrl = `${getBaseUrl()}index.html?token=${p.invite_token}`;

      return `<div class="patient-card ${!p.active ? "inactive" : ""}">
        <div class="patient-info">
          <div class="patient-name">${esc(p.full_name || "Aguardando onboarding")}</div>
          <div class="patient-meta">
            <span>📝 ${recordCount} registro${recordCount !== 1 ? "s" : ""}</span>
            <span>🕐 ${lastSeen}</span>
            ${!p.active ? '<span style="color:#c62828">Inativo</span>' : ""}
          </div>
        </div>
        <div class="patient-actions">
          <button class="t-btn t-btn-sm" onclick="Therapist.copyInvite('${inviteUrl}')">🔗 Copiar link</button>
          <button class="t-btn t-btn-sm" onclick="Therapist.viewRecords('${p.id}', '${esc(p.full_name || "Paciente")}')">📋 Ver registros</button>
          <button class="t-btn t-btn-sm t-btn-danger" onclick="Therapist.togglePatient('${p.id}', ${!p.active})">
            ${p.active ? "🔒 Desativar" : "✅ Ativar"}
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
      const inviteUrl = `${getBaseUrl()}index.html?token=${patient.invite_token}`;
      document.getElementById("new-patient-name").value = "";
      document.getElementById("invite-url-display").textContent = inviteUrl;
      document.getElementById("invite-result").style.display = "block";
      await renderPatients();
      showToast("✅ Convite criado! Copie o link e envie ao paciente.");
    } catch (e) {
      showToast("Erro ao criar convite: " + e.message);
    } finally {
      setLoading("btn-create-patient", false);
    }
  }

  function copyInvite(url) {
    navigator.clipboard.writeText(url).then(() => showToast("🔗 Link copiado!"));
  }

  async function togglePatient(id, active) {
    try {
      await DB.Therapist.togglePatient(id, active);
      await renderPatients();
      showToast(active ? "✅ Paciente ativado." : "🔒 Paciente desativado.");
    } catch (e) {
      showToast("Erro: " + e.message);
    }
  }

  // ─── VER REGISTROS ────────────────────────────────────────────────────────
  async function viewRecords(patientId, patientName) {
    if (!profile) return;
    showView("view-patient-records");
    document.getElementById("pr-patient-name").textContent = patientName;
    document.getElementById("pr-records-area").innerHTML =
      '<div class="t-loading">Carregando registros...</div>';

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
        ${r.situation   ? `<div class="pr-field"><label>Situação</label><p>${esc(r.situation)}</p></div>`   : ""}
        ${r.thought     ? `<div class="pr-field"><label>Pensamento</label><p>${esc(r.thought)}</p></div>`    : ""}
        ${r.feeling     ? `<div class="pr-field"><label>Sentimento</label><p>${esc(r.feeling)}</p></div>`    : ""}
        ${r.alt_thought ? `<div class="pr-field"><label>Pensamento Alternativo</label><p>${esc(r.alt_thought)}</p></div>` : ""}
      </div>`).join("");
  }

  // ─── SETTINGS ────────────────────────────────────────────────────────────
  function showSettings() {
    if (!profile) return;
    showView("view-settings");
    document.getElementById("s-full-name").value    = profile.full_name || "";
    document.getElementById("s-crp").value          = profile.crp || "";
    document.getElementById("s-clinic").value       = profile.clinic_name || "";
    document.getElementById("s-report-email").value = profile.settings?.report_email || profile.email || "";
    document.getElementById("s-cycle-days").value   = profile.settings?.cycle_days || 10;
  }

  async function saveSettings() {
    if (!profile) return;
    const fullName    = document.getElementById("s-full-name")?.value.trim();
    const crp         = document.getElementById("s-crp")?.value.trim();
    const clinicName  = document.getElementById("s-clinic")?.value.trim();
    const reportEmail = document.getElementById("s-report-email")?.value.trim();
    const cycleDays   = parseInt(document.getElementById("s-cycle-days")?.value || "10");

    if (!fullName) { showToast("Informe seu nome completo."); return; }

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
      showToast("✅ Configurações salvas com sucesso!");
      showView("view-dashboard");
    } catch (e) {
      showToast("Não foi possível salvar. Tente novamente.");
    } finally {
      setLoading("btn-save-settings", false);
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  function esc(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function showError(id, msg, type = "error") {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = `t-msg t-msg-${type}`;
    el.style.display = "block";
  }

  function clearError(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = "";
    el.style.display = "none";
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
    showView, loadDashboard,
  };
})();

window.Therapist = Therapist;
document.addEventListener("DOMContentLoaded", Therapist.init);