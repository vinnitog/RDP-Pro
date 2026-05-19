const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function getRuleProps(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `CSS rule ${selector} should exist`);
  return Object.fromEntries(
    match[1]
      .split(";")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf(":");
        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).replace(/\s+/g, " ").replace(/,\s*/g, ",").trim(),
        ];
      })
  );
}

const appCss = read("css/app.css");
const therapistCss = read("css/therapist.css");
const indexHtml = read("index.html");
const patientHtml = read("paciente.html");
const therapistHtml = read("psicologo.html");
const therapistAliasHtml = read("therapist.html");
const appJs = read("js/app.js");
const dbJs = read("js/db.js");
const therapistJs = read("js/therapist.js");

for (const [file, html] of [
  ["index.html", indexHtml],
  ["paciente.html", patientHtml],
  ["psicologo.html", therapistHtml],
  ["therapist.html", therapistAliasHtml],
]) {
  assert.match(
    html,
    /family=Inter:wght@400;500;600;700&display=swap/,
    `${file}: should load the single app font`
  );
  assert.doesNotMatch(
    html,
    /family=.*(?:Lora|DM\+Sans)/,
    `${file}: should not load mixed font families`
  );
}

for (const [file, css] of [
  ["css/app.css", appCss],
  ["css/therapist.css", therapistCss],
]) {
  assert.match(css, /--font-app:\s*'Inter'/, `${file}: should expose the shared app font token`);
  assert.doesNotMatch(css, /font-family:\s*'Lora'/, `${file}: should not use Lora`);
  assert.doesNotMatch(css, /font-family:\s*'DM Sans'/, `${file}: should not use DM Sans`);
}

assert.doesNotMatch(
  indexHtml + patientHtml + therapistHtml + therapistAliasHtml + appJs,
  /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u,
  "UI source should not use colorful emoji icons"
);

assert.match(appJs, /function feelingIcon\(/, "history should render minimal icons for feelings");
assert.match(appJs, /function formatFeelingText\(/, "history should avoid duplicated feeling labels");
assert.match(appJs, /feeling-icon/, "feeling icons should use a dedicated style hook");
assert.match(appJs, /iconLabel\("clock"/, "insights should include a minimal icon for time patterns");
assert.match(appJs, /iconLabel\("heart"/, "insights should include a minimal icon for frequent feelings");
assert.match(appJs, /iconLabel\("trend"/, "insights should include a minimal icon for cycle trends");
assert.match(appCss, /\.feeling-icon/, "patient CSS should style feeling icons");

for (const html of [therapistHtml, therapistAliasHtml]) {
  assert.match(html, /class="t-btn t-btn-header t-btn-header-settings"/, "settings button should use polished header style");
  assert.match(html, /class="t-btn t-btn-header t-btn-header-logout"/, "logout button should use polished header style");
  assert.match(html, /class="ui-icon"/, "header actions should use monochrome inline icons");
}

assert.match(therapistCss, /\.t-btn-header/, "therapist header buttons should have dedicated styling");
assert.match(therapistCss, /\[data-theme="dark"\][\s\S]*\.t-btn-header/, "dark theme should style therapist header buttons");

// [hidden] must be enforced with !important so .t-btn display:inline-flex does not override it
assert.match(therapistCss, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/, "therapist.css must enforce [hidden] display:none !important");

// settings button must start hidden — only visible after login
for (const [file, html] of [["psicologo.html", therapistHtml], ["therapist.html", therapistAliasHtml]]) {
  assert.match(
    html,
    /t-btn-header-settings[^>]* hidden/,
    `${file}: settings button should start hidden (only visible after auth)`
  );
}

// tab bar must have safe-area-aware side padding for notched phones
assert.match(
  appCss,
  /\.tabs[\s\S]*?padding.*safe-area-inset/,
  "tabs container should handle safe-area insets for modern phones"
);

// individual tabs should have at least 8px horizontal padding (mobile refinement)
const tabMatch = appCss.match(/\.tab\s*\{([^}]+)\}/);
assert.ok(tabMatch, "css/app.css: .tab rule should exist");
assert.doesNotMatch(
  tabMatch[1],
  /padding:\s*0\s*4px/,
  "css/app.css: tab padding should be refined beyond 0 4px for mobile"
);

// patient header should not display the patient name next to the logout button
assert.doesNotMatch(
  indexHtml + patientHtml,
  /id="patient-name-header"/,
  "patient routes should not render patient name in the header"
);

assert.doesNotMatch(
  indexHtml + patientHtml,
  /id="therapist-name-header"/,
  "patient routes should not render therapist name in the header"
);

assert.match(indexHtml, /new URL\("paciente\.html", location\.href\)/, "index.html should redirect legacy traffic to paciente.html");
assert.match(indexHtml, /target\.search = location\.search/, "index.html redirect should preserve query params");
assert.match(indexHtml, /target\.hash = location\.hash/, "index.html redirect should preserve hash");

assert.doesNotMatch(
  appJs,
  /patient-name-header|therapist-name-header/,
  "js/app.js: patient header should not receive session names"
);

// logout button must match the therapist header button style (white bg, dark text)
assert.match(
  appCss,
  /--header-button-bg:\s*rgba\(255,255,255,0\.9\)/,
  "css/app.css: logout-btn should use white semi-opaque background matching t-btn-header"
);
const logoutBtn = getRuleProps(appCss, ".logout-btn");
const therapistHeaderBtn = getRuleProps(therapistCss, ".t-btn-header");
const therapistLogoutBtn = getRuleProps(therapistCss, ".t-btn-header-logout");

for (const prop of ["min-height", "border-radius", "border", "background", "color", "box-shadow", "gap"]) {
  assert.equal(logoutBtn[prop], therapistHeaderBtn[prop], `css/app.css: logout ${prop} should match therapist header button`);
}
assert.equal(logoutBtn.padding, "0 15px", "css/app.css: logout should use the same horizontal padding as therapist logout");
assert.equal(therapistLogoutBtn["padding-inline"], "15px", "css/therapist.css: therapist logout should define matching inline padding");

assert.equal(
  getRuleProps(appCss, ".logout-btn:hover").background,
  getRuleProps(therapistCss, ".t-btn-header:hover:not(:disabled)").background,
  "css/app.css: logout hover background should match therapist header hover"
);
assert.equal(
  getRuleProps(appCss, '[data-theme="dark"] .logout-btn').background,
  getRuleProps(therapistCss, '[data-theme="dark"] .t-btn-header').background,
  "css/app.css: dark logout background should match therapist header button"
);

// db.js must have a fetchAndMerge function to pull remote records into localStorage
assert.match(
  dbJs,
  /fetchAndMerge/,
  "js/db.js: Records must expose fetchAndMerge() to sync remote records into localStorage"
);

assert.match(dbJs, /generatePatientInvite/, "js/db.js: therapist should be able to regenerate invite tokens");
assert.match(dbJs, /deletePatientInvite/, "js/db.js: therapist should be able to hard-delete unused invites");
assert.match(therapistJs, /Gerar novo link/, "js/therapist.js: patient cards should generate a fresh invite link");
assert.match(therapistJs, /Deletar convite/, "js/therapist.js: unused onboarding invites should expose delete action");
assert.doesNotMatch(therapistJs, />Copiar link</, "js/therapist.js: patient cards should not show copy-link action");

// bootApp must call fetchAndMerge so remote records are pulled on login
assert.match(
  appJs,
  /fetchAndMerge/,
  "js/app.js: bootApp must call fetchAndMerge() to load records from Supabase"
);

console.log("UI consistency tests passed");
