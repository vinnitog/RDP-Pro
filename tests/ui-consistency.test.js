const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

const appCss = read("css/app.css");
const therapistCss = read("css/therapist.css");
const patientHtml = read("paciente.html");
const therapistHtml = read("psicologo.html");
const therapistAliasHtml = read("therapist.html");
const appJs = read("js/app.js");
const dbJs = read("js/db.js");

for (const [file, html] of [
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
  patientHtml + therapistHtml + therapistAliasHtml + appJs,
  /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u,
  "UI source should not use colorful emoji icons"
);

assert.match(appJs, /function feelingIcon\(/, "history should render minimal icons for feelings");
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
  patientHtml,
  /id="patient-name-header"/,
  "paciente.html: patient name div must be removed from the header"
);

// logout button must match the therapist header button style (white bg, dark text)
assert.match(
  appCss,
  /\.logout-btn[\s\S]*?background:\s*rgba\(255,255,255,0\.9/,
  "css/app.css: logout-btn should use white semi-opaque background matching t-btn-header"
);

// db.js must have a fetchAndMerge function to pull remote records into localStorage
assert.match(
  dbJs,
  /fetchAndMerge/,
  "js/db.js: Records must expose fetchAndMerge() to sync remote records into localStorage"
);

// bootApp must call fetchAndMerge so remote records are pulled on login
assert.match(
  appJs,
  /fetchAndMerge/,
  "js/app.js: bootApp must call fetchAndMerge() to load records from Supabase"
);

console.log("UI consistency tests passed");
