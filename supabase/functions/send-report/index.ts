import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportPayload {
  patient_id: string;
  invite_token: string;
  records: Record<string, unknown>[];
  patient_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: ReportPayload = await req.json();
    const { patient_id, invite_token, records, patient_name } = payload;

    // Valida token e busca dados do psicólogo
    const { data: patientData, error: patientError } = await supabase
      .rpc("get_patient_by_token", { p_token: invite_token })
      .single();

    if (patientError || !patientData) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou paciente não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Busca e-mail de destino das settings do psicólogo
    const reportEmail =
      patientData.settings?.report_email ||
      (await supabase
        .from("therapists")
        .select("email")
        .eq("id", patientData.therapist_id)
        .single()
        .then((r) => r.data?.email));

    if (!reportEmail) {
      return new Response(
        JSON.stringify({ error: "E-mail do psicólogo não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Monta corpo do e-mail em HTML
    const now = new Date().toLocaleDateString("pt-BR");
    const patientLabel = patient_name || "Paciente";
    const therapistName = patientData.therapist_name || "Profissional";
    const clinicName = patientData.clinic_name || "";

    const recordsHtml = [...records].reverse().map((r: any, i, arr) => {
      const delta = Number(r.anxiety2) - Number(r.anxiety1);
      const deltaText =
        delta < 0
          ? `↓ redução de ${Math.abs(delta)} ponto${Math.abs(delta) > 1 ? "s" : ""}`
          : delta > 0
          ? `↑ aumento de ${delta} ponto${delta > 1 ? "s" : ""}`
          : "= sem alteração";

      return `
        <tr style="background:${i % 2 === 0 ? "#f9f9f9" : "#ffffff"}">
          <td style="padding:10px 12px;border:1px solid #e0e0e0;font-size:12px;color:#555;white-space:nowrap">${r.datetime || ""}</td>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;font-size:12px">${r.situation || "—"}</td>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;font-size:12px">${r.thought || "—"}</td>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;font-size:12px">${r.feeling || "—"}</td>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;font-size:12px;text-align:center;font-weight:bold">${r.anxiety1}/10</td>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;font-size:12px">${r.reaction || "—"}</td>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;font-size:12px">${r.alt_thought || r.altThought || "—"}</td>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;font-size:12px;text-align:center;font-weight:bold">${r.anxiety2}/10</td>
          <td style="padding:10px 12px;border:1px solid #e0e0e0;font-size:12px;text-align:center;color:${delta < 0 ? "#2e7d32" : delta > 0 ? "#c62828" : "#555"}">${deltaText}</td>
        </tr>`;
    }).join("");

    const htmlBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;color:#1e1e1e;margin:0;padding:0;background:#f4f4f4">
  <div style="max-width:900px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:#4a5535;padding:28px 32px">
      <h1 style="color:#e8edda;font-size:20px;margin:0;font-weight:600">🧠 Registro de Pensamentos — RDP Pro</h1>
      <p style="color:#b5c49a;margin:6px 0 0;font-size:13px">
        ${clinicName ? clinicName + " · " : ""}${therapistName}
      </p>
    </div>
    <div style="padding:24px 32px">
      <p style="margin:0 0 6px;font-size:14px;color:#555">
        <strong>Paciente:</strong> ${patientLabel}
      </p>
      <p style="margin:0 0 6px;font-size:14px;color:#555">
        <strong>Período:</strong> ${records.length} registro${records.length !== 1 ? "s" : ""} enviados em ${now}
      </p>
      <p style="margin:0 0 20px;font-size:13px;color:#888">
        Os dados ficam armazenados no dispositivo do paciente. Este e-mail é gerado automaticamente pelo app RDP Pro.
      </p>

      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#4a5535">
              <th style="padding:10px 12px;border:1px solid #3a4428;color:#e8edda;text-align:left;font-size:11px;white-space:nowrap">Data / Hora</th>
              <th style="padding:10px 12px;border:1px solid #3a4428;color:#e8edda;text-align:left;font-size:11px">Situação</th>
              <th style="padding:10px 12px;border:1px solid #3a4428;color:#e8edda;text-align:left;font-size:11px">Pens. Automático</th>
              <th style="padding:10px 12px;border:1px solid #3a4428;color:#e8edda;text-align:left;font-size:11px">Sentimento</th>
              <th style="padding:10px 12px;border:1px solid #3a4428;color:#e8edda;text-align:center;font-size:11px">Anx. Inicial</th>
              <th style="padding:10px 12px;border:1px solid #3a4428;color:#e8edda;text-align:left;font-size:11px">Reação</th>
              <th style="padding:10px 12px;border:1px solid #3a4428;color:#e8edda;text-align:left;font-size:11px">Pens. Alternativo</th>
              <th style="padding:10px 12px;border:1px solid #3a4428;color:#e8edda;text-align:center;font-size:11px">Anx. Final</th>
              <th style="padding:10px 12px;border:1px solid #3a4428;color:#e8edda;text-align:center;font-size:11px">Variação</th>
            </tr>
          </thead>
          <tbody>${recordsHtml}</tbody>
        </table>
      </div>

      <p style="margin:24px 0 0;font-size:11px;color:#aaa;text-align:center">
        Enviado pelo app RDP Pro · ${new Date().toLocaleString("pt-BR")}
      </p>
    </div>
  </div>
</body>
</html>`;

    // Envia via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RDP Pro <noreply@rdppro.com.br>",
        to: [reportEmail],
        subject: `Registro de Pensamentos — ${patientLabel} · ${now}`,
        html: htmlBody,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error("Resend error:", err);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar e-mail", detail: err }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualiza last_seen_at do paciente
    await supabase
      .from("patients")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", patient_id);

    return new Response(
      JSON.stringify({ ok: true, sent_to: reportEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
