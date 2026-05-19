const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migrations = [
  "supabase/migrations/003_patient_auth_ptbr_routes.sql",
  "supabase/migrations/004_repair_patient_auth_rpc.sql",
  "supabase/migrations/005_fix_claim_patient_invite_ambiguity.sql",
  "supabase/migrations/006_invite_single_use.sql",
];

function readMigration(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function getFunctionBody(sql, functionName) {
  const start = sql.search(new RegExp(`create (?:or replace )?function public\\.${functionName}\\b`, "i"));
  assert.notEqual(start, -1, `${functionName} not found`);

  const bodyStart = sql.indexOf("as $$", start);
  assert.notEqual(bodyStart, -1, `${functionName} body start not found`);

  const bodyEnd = sql.indexOf("$$;", bodyStart + 5);
  assert.notEqual(bodyEnd, -1, `${functionName} body end not found`);

  return sql.slice(bodyStart, bodyEnd);
}

for (const migration of migrations) {
  const sql = readMigration(migration);
  const body = getFunctionBody(sql, "claim_patient_invite");

  assert.doesNotMatch(
    body,
    /\bwhere\s+invite_token\s*=\s*p_token\b/i,
    `${migration}: claim_patient_invite must qualify patients.invite_token to avoid PL/pgSQL ambiguity`
  );

  assert.match(
    body,
    /\bwhere\s+(?:p|pt|patients)\.invite_token\s*=\s*p_token\b/i,
    `${migration}: claim_patient_invite should compare p_token against a qualified invite_token column`
  );

  assert.doesNotMatch(
    body,
    /\bcoalesce\(email\b/i,
    `${migration}: claim_patient_invite should qualify email in update expressions`
  );

  assert.doesNotMatch(
    body,
    /\b,\s*full_name\s*,\s*v_email\)/i,
    `${migration}: claim_patient_invite should qualify full_name in update expressions`
  );

  assert.doesNotMatch(
    body,
    /\bwhere\s+id\s*=\s*v_patient\.id\b/i,
    `${migration}: claim_patient_invite should qualify id in update where clause`
  );
}

const inviteSql = readMigration("supabase/migrations/006_invite_single_use.sql");
const getPatientByTokenBody = getFunctionBody(inviteSql, "get_patient_by_token");
const claimPatientInviteBody = getFunctionBody(inviteSql, "claim_patient_invite");

assert.match(
  inviteSql,
  /add column if not exists invite_used_at timestamptz/i,
  "006: patients should track when an invite has been used"
);
assert.match(
  getPatientByTokenBody,
  /pt\.invite_used_at\s+is\s+null/i,
  "006: get_patient_by_token should only validate unused invites"
);
assert.match(
  claimPatientInviteBody,
  /p\.invite_used_at\s+is\s+null/i,
  "006: claim_patient_invite should reject already-used invites"
);
assert.match(
  claimPatientInviteBody,
  /invite_used_at\s*=\s*now\(\)/i,
  "006: claim_patient_invite should mark the invite as used"
);

console.log("SQL RPC regression tests passed");
