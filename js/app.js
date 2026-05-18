// RDP Pro — App do Paciente
// Roteamento simples por hash + estado global mínimo

const App = (() => {
  let state = {
    session:  null,   // dados do paciente (token, therapist_id, etc.)
    records:  [],
    editingId: null,
    maxDays:  10,
    pendingInviteToken: null,
  };

  // ─── INIT ──────────────────────────────────────────────────────────────────
  async function init() {
    const params = new URLSearchParams(location.search);
    const urlToken = params.get("convite") || params.get("token");

    try {
      if (urlToken) {
        state.pendingInviteToken = urlToken;
        DB.Patient.savePendingInvite(urlToken);
        state.session = await DB.Patient.resolveToken(urlToken);
        // Remove token da URL sem reload
        history.replaceState({}, "", location.pathname);
      }

      const authSession = await DB.Patient.getAuthSession();
      const pendingToken = state.pendingInviteToken || DB.Patient.getPendingInvite();
      if (authSession && pendingToken) {
        state.session = await DB.Patient.claimInvite(
          pendingToken,
          state.session?.patient_name || null
        );
      } else if (authSession) {
        state.session = await DB.Patient.resolveAuthSession();
      } else {
        state.session = DB.Patient.get();
      }
    } catch (e) {
      showScreen("screen-invalid-token");
      return;
    }

    if (!state.session) {
      showScreen("screen-patient-auth");
      renderPatientAuth();
      return;
    }

    if (!await DB.Patient.getAuthSession()) {
      showScreen("screen-patient-auth");
      renderPatientAuth();
      return;
    }

    // Onboarding se não tem nome ainda
    if (!state.session.patient_name) {
      showScreen("screen-onboarding");
      renderOnboarding();
      return;
    }

    bootApp();
  }

  function bootApp() {
    state.records = DB.Records.getAll();
    state.maxDays = state.session?.settings?.cycle_days || 10;
    showScreen("screen-app");
    renderAll();
    setNow();

    // Tenta sincronizar pendentes silenciosamente
    DB.Records.syncPending().catch(() => {});
  }

  // ─── TELAS ────────────────────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
  }

  function renderPatientAuth() {
    const hasInvite = Boolean(state.pendingInviteToken || DB.Patient.getPendingInvite() || state.session?.invite_token);
    const title = document.getElementById("patient-auth-title");
    const copy = document.getElementById("patient-auth-copy");
    const inviteNote = document.getElementById("patient-auth-invite-note");

    if (title) title.textContent = hasInvite ? "Crie seu acesso" : "Entre na sua conta";
    if (copy) {
      copy.textContent = hasInvite
        ? "Seu convite foi validado. Agora crie uma conta ou entre para vincular este acesso ao seu e-mail."
        : "Use o e-mail e a senha cadastrados para acessar seus registros.";
    }
    if (inviteNote) inviteNote.style.display = hasInvite ? "block" : "none";
  }

  async function completePatientAuth() {
    const pendingToken =
      state.pendingInviteToken ||
      DB.Patient.getPendingInvite() ||
      state.session?.invite_token;

    if (pendingToken) {
      state.session = await DB.Patient.claimInvite(
        pendingToken,
        state.session?.patient_name || document.getElementById("patient-signup-name")?.value.trim() || null
      );
    } else {
      state.session = await DB.Patient.resolveAuthSession();
    }

    if (!state.session) {
      throw new Error("Esta conta ainda não está vinculada a um convite.");
    }

    if (!state.session.patient_name) {
      showScreen("screen-onboarding");
      renderOnboarding();
      return;
    }

    bootApp();
  }

  async function submitPatientLogin() {
    const email = document.getElementById("patient-login-email")?.value.trim();
    const password = document.getElementById("patient-login-password")?.value;

    if (!email || !password) {
      showPatientAuthMessage("Preencha e-mail e senha");
      return;
    }

    setPatientAuthLoading("btn-patient-login", true);
    try {
      await DB.Patient.signIn({ email, password });
      await completePatientAuth();
    } catch (e) {
      showPatientAuthMessage(e.message || "Não foi possível entrar");
    } finally {
      setPatientAuthLoading("btn-patient-login", false);
    }
  }

  async function submitPatientSignup() {
    const fullName = document.getElementById("patient-signup-name")?.value.trim();
    const email = document.getElementById("patient-signup-email")?.value.trim();
    const password = document.getElementById("patient-signup-password")?.value;
    const hasInvite = Boolean(state.pendingInviteToken || DB.Patient.getPendingInvite() || state.session?.invite_token);

    if (!hasInvite) {
      showPatientAuthMessage("Para criar sua conta, abra primeiro o convite enviado pelo seu psicólogo(a).");
      return;
    }
    if (!fullName || !email || !password) {
      showPatientAuthMessage("Nome, e-mail e senha são obrigatórios");
      return;
    }
    if (password.length < 6) {
      showPatientAuthMessage("Senha deve ter pelo menos 6 caracteres");
      return;
    }

    setPatientAuthLoading("btn-patient-signup", true);
    try {
      const result = await DB.Patient.signUp({ email, password, fullName });
      if (!result.session) {
        showPatientAuthMessage("Conta criada. Confirme seu e-mail e depois volte para entrar.", "success");
        return;
      }
      await completePatientAuth();
    } catch (e) {
      showPatientAuthMessage(e.message || "Não foi possível criar a conta");
    } finally {
      setPatientAuthLoading("btn-patient-signup", false);
    }
  }

  function showPatientAuthMessage(msg, type = "error") {
    const el = document.getElementById("patient-auth-message");
    if (!el) return;
    el.textContent = msg;
    el.className = `patient-auth-message ${type}`;
    el.style.display = "block";
  }

  function setPatientAuthLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle("btn-loading", loading);
  }

  // ─── ONBOARDING ───────────────────────────────────────────────────────────
  function renderOnboarding() {
    const therapistName = state.session?.therapist_name || "seu psicólogo(a)";
    const clinicName    = state.session?.clinic_name || "";

    document.getElementById("ob-therapist-name").textContent = therapistName;
    document.getElementById("ob-clinic-name").textContent    = clinicName;
  }

  async function submitOnboarding() {
    const name = document.getElementById("ob-patient-name").value.trim();
    if (!name) { showToast("Digite seu nome para continuar"); return; }

    state.session.patient_name = name;
    DB.Patient.save(state.session);

    // Atualiza nome no Supabase pela conta vinculada do paciente.
    try {
      await DB.Patient.updateName(name);
    } catch {}

    bootApp();
  }

  async function signOut() {
    await DB.Patient.signOut();
    state.session = null;
    state.records = [];
    showScreen("screen-patient-auth");
    renderPatientAuth();
  }

  // ─── RENDERIZAÇÃO PRINCIPAL ───────────────────────────────────────────────
  function renderAll() {
    renderHeader();
    applyLockUI();
    renderHistory();
    applyTheme();
  }

  function renderHeader() {
    const el = document.getElementById("patient-name-header");
    if (el) el.textContent = state.session?.patient_name || "";
    const el2 = document.getElementById("therapist-name-header");
    if (el2) el2.textContent = state.session?.therapist_name || "";
  }

  // ─── TEMA ─────────────────────────────────────────────────────────────────
  let darkMode = localStorage.getItem("rdp_dark") === "1";
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "");
    const btn = document.getElementById("theme-btn");
    if (btn) btn.textContent = darkMode ? "☀️" : "🌙";
  }
  function toggleTheme() {
    darkMode = !darkMode;
    localStorage.setItem("rdp_dark", darkMode ? "1" : "0");
    applyTheme();
  }

  // ─── TABS ─────────────────────────────────────────────────────────────────
  function showTab(name, el) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.getElementById("page-" + name).classList.add("active");
    if (el) el.classList.add("active");
    if (name === "historico") renderHistory();
    if (name === "formulario") applyLockUI();
    if (name === "insights") renderInsights();
  }

  function goHistory() {
    showTab("historico", document.querySelectorAll(".tab")[1]);
  }

  // ─── LOCK ─────────────────────────────────────────────────────────────────
  function isLocked() { return DB.Records.countDays() >= state.maxDays; }

  function applyLockUI() {
    const locked = isLocked();
    document.getElementById("form-locked").style.display  = locked ? "block" : "none";
    document.getElementById("form-content").style.display = locked ? "none"  : "block";
  }

  // ─── FORMULÁRIO ───────────────────────────────────────────────────────────
  function setNow() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    document.getElementById("f-date").value =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    document.getElementById("f-time").value =
      `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function updateCount(fid, cid) {
    const l = document.getElementById(fid)?.value.length || 0;
    const el = document.getElementById(cid);
    if (el) el.textContent = l > 0 ? l + " car." : "";
  }

  function clearForm() {
    setNow();
    state.editingId = null;
    ["f-situation","f-thought","f-feeling","f-reaction","f-alt-thought"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) { el.value = ""; el.style.height = ""; }
    });
    ["cc-situation","cc-thought","cc-feeling","cc-reaction","cc-alt"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "";
    });
    setSlider("f-anxiety1", "anx1-val", 0);
    setSlider("f-anxiety2", "anx2-val", 0);
    const btn = document.getElementById("btn-save");
    if (btn) { btn.textContent = "💾 Salvar Registro"; btn.classList.remove("saved"); }
  }

  function setSlider(inputId, valId, val) {
    const input = document.getElementById(inputId);
    const span  = document.getElementById(valId);
    if (input) input.value = val;
    if (span)  span.textContent = val;
  }

  function getDatetimeDisplay() {
    const d = document.getElementById("f-date")?.value;
    const t = document.getElementById("f-time")?.value;
    if (!d) return new Date().toLocaleString("pt-BR");
    const [y, mo, day] = d.split("-");
    return `${day}/${mo}/${y}${t ? ", " + t : ""}`;
  }

  function saveRecord() {
    if (isLocked() && !state.editingId) {
      showToast("Limite atingido. Envie o histórico primeiro.");
      return;
    }

    const data = {
      datetime:   getDatetimeDisplay(),
      date_key:   document.getElementById("f-date")?.value || new Date().toLocaleDateString("pt-BR"),
      situation:  document.getElementById("f-situation")?.value.trim(),
      thought:    document.getElementById("f-thought")?.value.trim(),
      feeling:    document.getElementById("f-feeling")?.value.trim(),
      anxiety1:   Number(document.getElementById("f-anxiety1")?.value || 0),
      reaction:   document.getElementById("f-reaction")?.value.trim(),
      altThought: document.getElementById("f-alt-thought")?.value.trim(),
      anxiety2:   Number(document.getElementById("f-anxiety2")?.value || 0),
    };

    if (!data.situation && !data.thought && !data.feeling) {
      showToast("Preencha pelo menos situação, pensamento ou sentimento");
      return;
    }

    if (state.editingId) {
      DB.Records.update(state.editingId, data);
      state.editingId = null;
    } else {
      DB.Records.add(data);
    }

    state.records = DB.Records.getAll();

    const btn = document.getElementById("btn-save");
    if (btn) {
      btn.textContent = "✅ Salvo!";
      btn.classList.add("saved");
      setTimeout(() => {
        btn.textContent = "💾 Salvar Registro";
        btn.classList.remove("saved");
      }, 1800);
    }

    clearForm();
    showToast("Registro salvo! 💚");
    setTimeout(goHistory, 1000);
  }

  // ─── EXPORTAÇÃO ───────────────────────────────────────────────────────────
  async function sendReport() {
    const records = DB.Records.getAll();
    if (!records.length) { showToast("Nenhum registro para enviar"); return; }

    const btn = document.getElementById("btn-send-email");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Enviando..."; }

    try {
      await DB.Report.send(records);
      showToast("✅ Relatório enviado com sucesso!");
    } catch (e) {
      showToast("Erro ao enviar: " + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "📧 Enviar Relatório"; }
    }
  }

  function exportPDF() {
    const records = DB.Records.getAll();
    if (!records.length) { showToast("Nenhum registro para exportar"); return; }
    if (typeof window.jspdf === "undefined") {
      showToast("Aguarde, carregando PDF...");
      setTimeout(exportPDF, 1500);
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const mX = 8, mY = 12, tW = W - mX * 2;
    const oliva = [74, 85, 53], oL = [212, 219, 192], rAlt = [240, 242, 234];

    // Cabeçalho com dados do psicólogo
    const therapistName = state.session?.therapist_name || "RDP Pro";
    const clinicName    = state.session?.clinic_name || "";
    const patientName   = state.session?.patient_name || "Paciente";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(74, 85, 53);
    doc.text("REGISTRO DE PENSAMENTOS", W / 2, mY, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(
      `${clinicName ? clinicName + " · " : ""}${therapistName} · Paciente: ${patientName}`,
      W / 2, mY + 6, { align: "center" }
    );

    const hdrs = ["Data/Hora", "Situação", "Pensamento\nAutomático", "Sentimento",
      "Grau\nInicial", "Reação", "Pensamento\nAlternativo", "Grau\nFinal"];
    const cw = [tW*0.10, tW*0.17, tW*0.15, tW*0.11, tW*0.08, tW*0.15, tW*0.16, tW*0.08];
    const sY = mY + 10, hH = 10;

    function drawHdr(y) {
      let x = mX;
      hdrs.forEach((h, i) => {
        doc.setFillColor(...oliva);
        doc.rect(x, y, cw[i], hH, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        const ls = h.split("\n"), lh = 3.2, tot = ls.length * lh;
        ls.forEach((l, li) => {
          doc.text(l, x + cw[i] / 2, y + (hH - tot) / 2 + li * lh + lh * 0.8, { align: "center" });
        });
        x += cw[i];
      });
    }

    drawHdr(sY);
    let y = sY + hH, rH = 20;

    records.forEach((r, idx) => {
      if (y + rH > H - mY) { doc.addPage(); y = mY; drawHdr(y); y += hH; }
      const bg = idx % 2 === 0 ? [255, 255, 255] : rAlt;
      doc.setFillColor(...bg);
      doc.rect(mX, y, tW, rH, "F");
      doc.setDrawColor(...oL);
      doc.setLineWidth(0.2);
      doc.rect(mX, y, tW, rH, "S");
      let x = mX;
      cw.forEach((w, ci) => {
        if (ci > 0) { doc.setDrawColor(...oL); doc.line(x, y, x, y + rH); }
        x += w;
      });
      const cells = [
        r.datetime || "", r.situation || "", r.thought || "", r.feeling || "",
        String(r.anxiety1 !== undefined ? r.anxiety1 : 0) + "/10",
        r.reaction || "", r.altThought || r.alt_thought || "",
        String(r.anxiety2 !== undefined ? r.anxiety2 : 0) + "/10",
      ];
      x = mX;
      cells.forEach((txt, ci) => {
        const g = ci === 4 || ci === 7;
        doc.setFont("helvetica", g ? "bold" : "normal");
        doc.setFontSize(g ? 9 : 6.5);
        doc.setTextColor(30, 30, 30);
        if (g) {
          doc.text(txt, x + cw[ci] / 2, y + rH / 2 + 1.5, { align: "center" });
        } else {
          const ls = doc.splitTextToSize(txt, cw[ci] - 3);
          ls.slice(0, Math.floor((rH - 4) / 3.2)).forEach((l, li) => {
            doc.text(l, x + 1.5, y + 4 + li * 3.2);
          });
        }
        x += cw[ci];
      });
      y += rH;
    });

    doc.setDrawColor(...oliva);
    doc.setLineWidth(0.5);
    doc.line(mX, y, mX + tW, y);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Gerado pelo app RDP Pro", W / 2, H - 4, { align: "center" });
    doc.save(`RDP-Pro-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`);
    showToast("PDF exportado! 📄");
  }

  function confirmClear() {
    if (confirm("Histórico enviado?\n\nTodos os registros serão apagados e um novo ciclo começará.")) {
      DB.Records.clearAll();
      state.records = [];
      renderHistory();
      applyLockUI();
      showToast("Histórico limpo! Novo ciclo iniciado ✨");
    }
  }

  // ─── HISTÓRICO ────────────────────────────────────────────────────────────
  function feelingEmoji(feeling) {
    if (!feeling) return "😔";
    const f = feeling.toLowerCase();
    if (/raiva|irrita|bravo|fúria|revolta|ódio/.test(f))          return "😡";
    if (/ansied|nervos|preocup|aperto|tenso|tensão|pavor/.test(f)) return "😰";
    if (/medo|terror|assust|pânico|horror/.test(f))               return "😨";
    if (/triste|tristeza|choro|vazio|solidão|sozinho/.test(f))    return "😢";
    if (/vergonha|humilha|constrang|envergonha/.test(f))          return "😳";
    if (/culpa|culpado|remorso/.test(f))                          return "😞";
    if (/frustrad|decep/.test(f))                                 return "🙁";
    if (/confus|perdido|desorient/.test(f))                       return "🤔";
    if (/cansaço|cansado|esgota|exaust/.test(f))                  return "😫";
    if (/feliz|alegri|contente|bem|animad/.test(f))               return "😄";
    if (/calmo|tranquil|paz|sereno/.test(f))                      return "😌";
    return "😔";
  }

  let _chart = null;

  function renderChart(records) {
    if (records.length < 2) return "";
    const ordered = records.slice(0, 10).reverse();
    const labels  = ordered.map((r) => r.datetime.split(",")[0].trim());
    const a2vals  = ordered.map((r) => +r.anxiety2);
    const id = "ac-" + Date.now();

    if (_chart) { try { _chart.destroy(); } catch {} _chart = null; }

    setTimeout(() => {
      const canvas = document.getElementById(id);
      if (!canvas || !window.Chart) return;
      _chart = new window.Chart(canvas, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Ansiedade final",
            data: a2vals,
            borderColor: "#6b7c4a",
            backgroundColor: "rgba(107,124,74,0.12)",
            fill: true, tension: 0.35,
            pointBackgroundColor: "#6b7c4a",
            pointBorderColor: "#fff",
            pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 8,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 10, ticks: { stepSize: 5, color: "#8a9e60", font: { size: 11 } }, grid: { color: "rgba(138,158,96,0.15)" } },
            x: { ticks: { color: "#8a9e60", font: { size: 11 }, maxRotation: 0 }, grid: { display: false } },
          },
        },
      });
    }, 50);

    return `<div class="chart-card"><div class="chart-title">📊 Evolução da Ansiedade</div><div class="chart-canvas-wrap"><canvas id="${id}"></canvas></div></div>`;
  }

  function renderHistory() {
    const area    = document.getElementById("history-area");
    if (!area) return;
    const records = DB.Records.getAll();
    const dias    = DB.Records.countDays();
    const locked  = dias >= state.maxDays;

    let html = "";

    if (records.length > 0) {
      const urgentStyle = locked ? "border-color:#f0ad4e;background:var(--surface2)" : "";
      html += `<div class="send-panel" style="${urgentStyle}">
        <div class="send-panel-label">
          ${locked
            ? '<strong style="color:#c0393b">🔒 Limite atingido — envie e limpe para continuar</strong>'
            : "<strong>Enviar histórico</strong>"}
          <span>${locked
            ? `Você atingiu ${state.maxDays} dias. <b>Novos registros estão bloqueados</b> até enviar e limpar.`
            : "Envie a qualquer momento e limpe para começar um novo ciclo."}</span>
        </div>
        <div class="send-panel-btns">
          <button class="btn-export-pdf" onclick="App.exportPDF()">📄 PDF</button>
          <button class="btn-export-email" id="btn-send-email" onclick="App.sendReport()">📧 Enviar Relatório</button>
          <button class="btn-export-clear" onclick="App.confirmClear()">🗑️ Limpar</button>
        </div>
      </div>`;
    }

    html += renderChart(records);

    if (!records.length) {
      // [UI] empty state com CTA — direciona o usuário para a ação
      html += `<div class="history-empty"><div class="icon">📖</div><p>Nenhum registro ainda.<br>Preencha o formulário!</p><button class="empty-cta" onclick="App.showTab('formulario', document.querySelectorAll('.tab')[0])">📝 Fazer primeiro registro</button></div>`;
    } else {
      html += `<div class="days-counter">📅 <span>${dias}</span> dia${dias !== 1 ? "s" : ""} de ${state.maxDays}</div>`;
      html += records.map((r) => {
        const safe = (s) => (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        const syncDot = r.synced
          ? '<span title="Sincronizado" style="color:#6b7c4a;font-size:10px">●</span>'
          : '<span title="Pendente de sincronização" style="color:#f0ad4e;font-size:10px">●</span>';
        return `<div class="history-item" id="item-${r.id}">
          <div class="history-summary" onclick="App.toggleItem(${r.id})">
            <div class="history-summary-row">
              <div class="history-date">${safe(r.datetime)} ${syncDot}</div>
              <span class="history-chevron">▾</span>
            </div>
            <div class="history-situation">${safe(r.situation || "(sem situação)")}</div>
            <div class="history-feeling">${feelingEmoji(r.feeling)} ${safe(r.feeling || "–")}</div>
            <div class="history-anx">Ansiedade: ${r.anxiety1}/10 → ${r.anxiety2}/10</div>
          </div>
          <div class="history-detail">
            ${r.thought ? `<div class="detail-row"><label>💭 Pensamento Automático</label><p>${safe(r.thought)}</p></div>` : ""}
            ${r.reaction ? `<div class="detail-row"><label>⚡ Reação</label><p>${safe(r.reaction)}</p></div>` : ""}
            ${(r.altThought || r.alt_thought) ? `<div class="detail-row"><label>🌱 Pensamento Alternativo</label><p>${safe(r.altThought || r.alt_thought)}</p></div>` : ""}
            <div class="detail-actions">
              <button class="btn-edit" onclick="App.loadRecord(${r.id})">✏️ Editar</button>
              <button class="btn-del"  onclick="App.deleteRecord(${r.id})">🗑️ Deletar</button>
            </div>
          </div>
        </div>`;
      }).join("");
    }

    area.innerHTML = html;
    applyLockUI();
  }

  // ─── INSIGHTS ─────────────────────────────────────────────────────────────
  function renderInsights() {
    const records = DB.Records.getAll();
    const area = document.getElementById("insights-area");
    if (!area) return;

    if (records.length < 2) {
      area.innerHTML = `<div class="history-empty"><div class="icon">📈</div><p>Adicione pelo menos 2 registros<br>para ver seus padrões.</p></div>`;
      return;
    }

    // Métricas
    const avg1 = records.reduce((s, r) => s + r.anxiety1, 0) / records.length;
    const avg2 = records.reduce((s, r) => s + r.anxiety2, 0) / records.length;
    const avgDelta = avg2 - avg1;
    const reductions = records.filter((r) => r.anxiety2 < r.anxiety1).length;
    const reductionRate = Math.round((reductions / records.length) * 100);

    // Sentimentos mais frequentes
    const feelingCounts = {};
    records.forEach((r) => {
      if (!r.feeling) return;
      const key = r.feeling.toLowerCase().split(/[\s,]/)[0];
      feelingCounts[key] = (feelingCounts[key] || 0) + 1;
    });
    const topFeelings = Object.entries(feelingCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Horários
    const hourCounts = Array(24).fill(0);
    records.forEach((r) => {
      const match = (r.datetime || "").match(/,\s*(\d{1,2}):/);
      if (match) hourCounts[parseInt(match[1])]++;
    });
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const peakPeriod = peakHour < 12 ? "manhã" : peakHour < 18 ? "tarde" : "noite";

    // Progresso entre ciclos (usa countDays como proxy do ciclo)
    const deltaSign = avgDelta < 0 ? "↓" : avgDelta > 0 ? "↑" : "=";
    const deltaColor = avgDelta < 0 ? "#2e7d32" : avgDelta > 0 ? "#c62828" : "#555";

    area.innerHTML = `
      <div class="insights-grid">
        <div class="insight-card">
          <div class="insight-label">Ansiedade média inicial</div>
          <div class="insight-val">${avg1.toFixed(1)}<span class="insight-unit">/10</span></div>
        </div>
        <div class="insight-card">
          <div class="insight-label">Ansiedade média final</div>
          <div class="insight-val">${avg2.toFixed(1)}<span class="insight-unit">/10</span></div>
        </div>
        <div class="insight-card">
          <div class="insight-label">Variação média</div>
          <div class="insight-val" style="color:${deltaColor}">${deltaSign} ${Math.abs(avgDelta).toFixed(1)}</div>
        </div>
        <div class="insight-card">
          <div class="insight-label">Reflexões com redução</div>
          <div class="insight-val">${reductionRate}<span class="insight-unit">%</span></div>
        </div>
      </div>

      <div class="insight-section">
        <div class="insight-section-title">🕐 Quando você mais registra</div>
        <div class="insight-section-body">Seus registros se concentram no período da <strong>${peakPeriod}</strong> (pico às ${peakHour}h).</div>
      </div>

      ${topFeelings.length ? `
      <div class="insight-section">
        <div class="insight-section-title">❤️ Sentimentos mais frequentes</div>
        ${topFeelings.map(([feeling, count]) => `
          <div class="feeling-bar-row">
            <span class="feeling-label">${feeling}</span>
            <div class="feeling-bar-wrap">
              <div class="feeling-bar" style="width:${Math.round((count / records.length) * 100)}%"></div>
            </div>
            <span class="feeling-count">${count}x</span>
          </div>`).join("")}
      </div>` : ""}

      <div class="insight-section">
        <div class="insight-section-title">📈 Tendência do ciclo</div>
        <div class="insight-section-body">${
          avgDelta < -1
            ? "Ótimo progresso! Sua ansiedade reduziu consistentemente após as reflexões."
            : avgDelta < 0
            ? "Progresso gradual. Cada reflexão tem ajudado a reduzir um pouco a ansiedade."
            : avgDelta === 0
            ? "Estável. As reflexões mantêm a ansiedade no mesmo nível."
            : "A ansiedade ainda aumenta após algumas reflexões. Isso é normal no início — continue praticando."
        }</div>
      </div>
    `;
  }

  // ─── AÇÕES DE ITEM ────────────────────────────────────────────────────────
  function toggleItem(id) {
    document.getElementById("item-" + id)?.classList.toggle("open");
  }

  function loadRecord(id) {
    const r = DB.Records.getAll().find((x) => x.id === id);
    if (!r) return;

    const parts = r.datetime.split(",")[0].trim().split("/");
    if (parts.length === 3) {
      document.getElementById("f-date").value =
        `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
    }
    document.getElementById("f-time").value =
      r.datetime.includes(",") ? r.datetime.split(",")[1].trim() : "";

    [
      ["f-situation", "cc-situation", r.situation],
      ["f-thought",   "cc-thought",   r.thought],
      ["f-feeling",   "cc-feeling",   r.feeling],
      ["f-reaction",  "cc-reaction",  r.reaction],
      ["f-alt-thought","cc-alt",      r.altThought || r.alt_thought],
    ].forEach(([fid, cid, val]) => {
      const el = document.getElementById(fid);
      if (el) { el.value = val || ""; updateCount(fid, cid); }
    });

    setSlider("f-anxiety1", "anx1-val", r.anxiety1 || 0);
    setSlider("f-anxiety2", "anx2-val", r.anxiety2 || 0);

    showTab("formulario", document.querySelectorAll(".tab")[0]);
    state.editingId = r.id;
    const btn = document.getElementById("btn-save");
    if (btn) btn.textContent = "💾 Atualizar Registro";
    applyLockUI();

    setTimeout(() => {
      document.querySelectorAll(".field-card textarea").forEach(autoResize);
    }, 50);
    showToast("Registro carregado para edição");
  }

  function deleteRecord(id) {
    if (!confirm("Deletar este registro?")) return;
    DB.Records.delete(id);
    state.records = DB.Records.getAll();
    renderHistory();
    showToast("Registro deletado");
  }

  // ─── TOAST ────────────────────────────────────────────────────────────────
  function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2800);
  }

  // ─── PAINEL DO PSICÓLOGO (separado) ──────────────────────────────────────
  // Acessível em /psicologo.html

  return {
    init, submitOnboarding, submitPatientLogin, submitPatientSignup, signOut,
    toggleTheme, showTab, goHistory,
    setNow, autoResize, updateCount, clearForm, saveRecord,
    sendReport, exportPDF, confirmClear,
    toggleItem, loadRecord, deleteRecord, showToast,
    renderInsights,
  };
})();

window.App = App;
document.addEventListener("DOMContentLoaded", App.init);
