/* Bundles src/ into a single self-contained dist/index.html.
   Sources stay split by concern; the artifact needs one file.
   Run: node crm/broker/build.mjs */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "src");

/** Read every file in a directory tree, sorted so the numeric prefixes
 *  give a deterministic, dependency-correct concatenation order. */
function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(p));
    else out.push(p);
  }
  return out;
}

const styles = collect(join(src, "styles"))
  .filter((f) => f.endsWith(".css"))
  .map((f) => `/* ${f.slice(src.length + 1)} */\n${readFileSync(f, "utf8")}`)
  .join("\n");

// screens/ sorts after the bare NN-*.js files at the js/ root, which is what
// we want: icons/utils/store first, screens next, app.js last.
const scripts = collect(join(src, "js"))
  .filter((f) => f.endsWith(".js"))
  .sort((a, b) => {
    const rank = (f) => (f.endsWith("90-app.js") ? 2 : f.includes("/screens/") ? 1 : 0);
    return rank(a) - rank(b) || a.localeCompare(b);
  })
  .map((f) => `/* ---- ${f.slice(src.length + 1)} ---- */\n${readFileSync(f, "utf8")}`)
  .join("\n");

const html = readFileSync(join(src, "index.html"), "utf8")
  .replace("/*__STYLES__*/", () => styles)
  .replace("/*__SCRIPT__*/", () => scripts);

mkdirSync(join(here, "dist"), { recursive: true });
writeFileSync(join(here, "dist", "index.html"), html);
console.log(`built dist/index.html — ${(html.length / 1024).toFixed(1)} KB`);
