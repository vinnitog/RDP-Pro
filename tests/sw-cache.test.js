const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

const cacheMatch = sw.match(/const CACHE_NAME = 'rdp-pro-v(\d+)\.(\d+)'/);
assert.ok(cacheMatch, "sw.js: CACHE_NAME should use rdp-pro-v<major>.<minor> format");
const major = Number(cacheMatch[1]);
const minor = Number(cacheMatch[2]);
assert.ok(major > 1 || (major === 1 && minor >= 17), "sw.js: CACHE_NAME should be at least rdp-pro-v1.17");

for (const asset of [
  "./index.html",
  "./paciente.html",
  "./css/app.css",
  "./js/app.js",
  "./psicologo.html",
  "./therapist.html",
]) {
  assert.match(sw, new RegExp(asset.replace(/[./]/g, "\\$&")), `sw.js: should cache ${asset}`);
}

console.log("Service worker cache tests passed");
