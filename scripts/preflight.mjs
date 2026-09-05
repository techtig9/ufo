import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = ["package.json", ".env.example", "app", "components", "lib"];
const missing = required.filter((p) => !fs.existsSync(path.join(root, p)));

if (missing.length) {
  console.error("Missing required project paths:", missing.join(", "));
  process.exit(1);
}

const badTokens = ["border-white/8", "bg-white/8"];
let bad = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(css|ts|tsx|js|jsx)$/.test(entry.name)) {
      const text = fs.readFileSync(full, "utf8");
      for (const token of badTokens) {
        if (text.includes(token)) bad.push(`${full}: ${token}`);
      }
    }
  }
}
walk(root);
if (bad.length) {
  console.error("Invalid Tailwind opacity tokens found:");
  console.error(bad.join("\n"));
  process.exit(1);
}
// ---------------------------------------------------------------------------
// Company details must be filled before a production build.
//
// The legal pages, footer and contact copy previously shipped hardcoded
// placeholders ("[Your Name / Agency Name]", "[your contact email]"). Those are
// now centralised in lib/company.ts, and this check keeps an unfilled build
// from reaching production unnoticed. It is a warning locally and an error in
// CI/production, so local development is not blocked by details a developer
// cannot supply.
// ---------------------------------------------------------------------------
const companySrc = fs.readFileSync(path.join(root, "lib/company.ts"), "utf8");
const unset = [...companySrc.matchAll(/^\s*(\w+):\s*'TODO_[A-Z_]+'/gm)].map((m) => m[1]);

if (unset.length) {
  const isProduction = process.env.CI === "true" || process.env.NODE_ENV === "production";
  const message =
    `Company details are still unset in lib/company.ts: ${unset.join(", ")}.\n` +
    "These appear on the Terms, Privacy, Refunds and Cookie pages, the footer " +
    "and the contact page. Fill them in before launch.";

  if (isProduction) {
    console.error("Preflight failed:", message);
    process.exit(1);
  }
  console.warn("Preflight warning:", message);
}

console.log("UFO static preflight passed.");
