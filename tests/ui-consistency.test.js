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
  patientHtml + therapistHtml + therapistAliasHtml,
  /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u,
  "HTML should not use colorful emoji icons"
);

for (const html of [therapistHtml, therapistAliasHtml]) {
  assert.match(html, /class="t-btn t-btn-header t-btn-header-settings"/, "settings button should use polished header style");
  assert.match(html, /class="t-btn t-btn-header t-btn-header-logout"/, "logout button should use polished header style");
  assert.match(html, /class="ui-icon"/, "header actions should use monochrome inline icons");
}

assert.match(therapistCss, /\.t-btn-header/, "therapist header buttons should have dedicated styling");
assert.match(therapistCss, /\[data-theme="dark"\][\s\S]*\.t-btn-header/, "dark theme should style therapist header buttons");

console.log("UI consistency tests passed");
