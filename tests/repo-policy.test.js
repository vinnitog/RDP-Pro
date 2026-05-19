const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assertOrdered(content, labels, file) {
  let previous = -1;
  for (const label of labels) {
    const current = content.indexOf(label);
    assert.ok(current > previous, `${file}: expected ${label} after previous workflow step`);
    previous = current;
  }
}

const agents = read("AGENTS.md");
const context = read("context.md");
const gitignore = read(".gitignore");
const testCmd = read("test.cmd");

for (const [file, content] of [
  ["AGENTS.md", agents],
  ["context.md", context],
]) {
  assert.match(content, /C:\\Users\\Togszera\\Desktop\\RDP-Pro/, `${file}: should pin the correct workspace`);
  assert.match(content, /C:\\Users\\Togszera\\Documents\\RDP-Pro/, `${file}: should mention the wrong workspace as forbidden`);
  assertOrdered(content, ["senior-dev", "ui-ux-expert", "code-reviewer", "qa-senior", "qa-automate"], file);
  assert.match(content, /front-end sempre deve acionar `ui-ux-expert`, mesmo sem `\/ui-ux`|neste projeto isso vale mesmo sem `\/ui-ux`/, `${file}: should override ui-ux trigger for frontend changes`);
  assert.match(content, /HTML, CSS, layout, componentes, responsividade, acessibilidade visual, microinteracoes ou experiencia do usuario/, `${file}: should document exact frontend UI/UX triggers`);
  assert.match(content, /antes do `code-reviewer`|apos `ui-ux-expert` quando aplicavel/, `${file}: should place ui-ux before code review`);
  assert.match(content, /front-end for puramente logica e sem impacto visual\/UX|quando aplicavel/, `${file}: should document when ui-ux does not apply`);
  assert.match(content, /Branch base de trabalho: `develop`|Trabalhar sempre a partir de `develop`/, `${file}: should require develop as the work branch`);
  assert.match(content, /Nunca fazer push direto para `main`/, `${file}: should explicitly forbid direct pushes to main`);
  assert.match(content, /git add --/, `${file}: should require explicit staging`);
  assert.match(content, /git diff --cached/, `${file}: should require cached diff review before commit`);
  assert.match(content, /PR .*`develop -> main`|PR `develop -> main`|develop -> main/, `${file}: should require develop to main PR`);
  assert.match(content, /nao usar Browser|Nao usar Browser/i, `${file}: should forbid Browser for local blocked targets`);
  assert.match(content, /file:\/\/|localhost|127\.0\.0\.1/, `${file}: should name blocked local Browser targets`);
  assert.match(content, /ERR_BLOCKED_BY_CLIENT/, `${file}: should document the Browser block failure mode`);
}

assert.match(testCmd, /cd \/d "%~dp0"/, "test.cmd should run from its own directory");
assert.doesNotMatch(testCmd, /npm test/, "test.cmd should not call npm test");
assert.match(agents, /Como Aplicar Este Kit Em Novos Projetos/, "AGENTS.md should document how to reuse the kit");
for (const required of ["AGENTS.md", "test.cmd", "teste de politica", ".gitignore", "develop", "PR `develop -> main`", "PROJECT_CONTEXT.md"]) {
  assert.match(agents, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `AGENTS.md kit instructions should mention ${required}`);
}

for (const pattern of ["node_modules/", ".env", ".supabase/", "supabase/.temp/", ".claude/", "*.log", ".DS_Store", "Thumbs.db"]) {
  assert.match(gitignore, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `.gitignore should include ${pattern}`);
}
assert.doesNotMatch(gitignore, /^context\.md$/m, ".gitignore should not ignore tracked project context");

console.log("Repo policy tests passed");
