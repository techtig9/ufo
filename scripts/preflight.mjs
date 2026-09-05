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
// Company details must be configured before a production build.
//
// The legal pages, footer and contact copy previously shipped hardcoded
// placeholders ("[Your Name / Agency Name]", "[your contact email]"). Those are
// now read from the environment via lib/company.ts, and this check keeps an
// unconfigured build from reaching production unnoticed.
//
// Warning locally, error in CI/production: a developer running the app on their
// machine should not be blocked by details only the business owner can supply.
// ---------------------------------------------------------------------------
const COMPANY_VARS = [
  "UFO_COMPANY_LEGAL_NAME",
  "UFO_COMPANY_DISPLAY_NAME",
  "UFO_COMPANY_CONTACT_EMAIL",
  "UFO_COMPANY_JURISDICTION",
  "UFO_LEGAL_EFFECTIVE_DATE",
  "UFO_LAUNCH_DATE",
];

const unset = COMPANY_VARS.filter((v) => !(process.env[v] ?? "").trim());

if (unset.length) {
  const isProduction = process.env.CI === "true" || process.env.NODE_ENV === "production";
  const message =
    `Company details are not configured: ${unset.join(", ")}.\n` +
    "These appear on the Terms, Privacy, Refunds and Cookie pages, the footer " +
    "and the contact page. Set them in your deployment environment before launch.";

  if (isProduction) {
    console.error("Preflight failed:", message);
    process.exit(1);
  }
  console.warn("Preflight warning:", message);
}

console.log("UFO static preflight passed.");
