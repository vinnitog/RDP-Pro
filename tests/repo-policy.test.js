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
  assertOrdered(content, ["senior-dev", "code-reviewer", "qa-senior", "qa-automate"], file);
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

for (const pattern of ["node_modules/", ".env", ".supabase/", "supabase/.temp/", ".claude/", "*.log", ".DS_Store", "Thumbs.db"]) {
  assert.match(gitignore, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `.gitignore should include ${pattern}`);
}
assert.doesNotMatch(gitignore, /^context\.md$/m, ".gitignore should not ignore tracked project context");

console.log("Repo policy tests passed");
