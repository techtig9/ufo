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

/**
 * Is this build a RELEASE, or a preview someone is iterating on?
 *
 * The distinction matters because the two want opposite things. A preview
 * deploy of an unconfigured app is useful — it is how you get a URL before you
 * have the keys. A production deploy of one is a broken launch.
 *
 * On Vercel, VERCEL_ENV answers this exactly: "production" for a real deploy,
 * "preview" for everything else. Off Vercel, a CI run is a release gate and an
 * explicit NODE_ENV=production is a deliberate production build.
 *
 * Two earlier bugs this replaces: `CI === "true"` never matched Vercel, which
 * sets CI=1 — so the guard was silent on the one host it most needed to cover.
 * And keying on NODE_ENV alone would block every preview, since NODE_ENV is
 * "production" throughout any `next build`.
 */
const onVercel = Boolean(process.env.VERCEL);
const ci = (process.env.CI ?? "").toLowerCase();
const ciIsSet = ci !== "" && ci !== "0" && ci !== "false";

const isProduction = onVercel
  ? process.env.VERCEL_ENV === "production"
  : ciIsSet || process.env.NODE_ENV === "production";

let failed = false;

function requireInProduction(message) {
  if (isProduction) {
    console.error("Preflight failed:", message);
    failed = true;
    return;
  }
  console.warn("Preflight warning:", message);
}

const unsetCompany = COMPANY_VARS.filter((v) => !(process.env[v] ?? "").trim());
if (unsetCompany.length) {
  requireInProduction(
    `Company details are not configured: ${unsetCompany.join(", ")}.\n` +
      "These appear on the Terms, Privacy, Refunds and Cookie pages, the footer " +
      "and the contact page. Set them in your deployment environment before launch."
  );
}

// ---------------------------------------------------------------------------
// Service credentials.
//
// The app no longer refuses to BUILD without these — that made a first deploy
// impossible, because a build that fails produces nothing to add the keys to.
// It boots into a visible setup state instead. This is where the guarantee now
// lives: a production build without them fails here, deliberately, so the
// leniency helps a first deploy without letting an unconfigured one ship
// quietly to customers.
// ---------------------------------------------------------------------------
const SERVICE_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GROQ_API_KEY",
];

const unsetService = SERVICE_VARS.filter((v) => !(process.env[v] ?? "").trim());
if (unsetService.length) {
  requireInProduction(
    `Service credentials are not configured: ${unsetService.join(", ")}.\n` +
      "The app will build and serve its public pages, but sign-in, the dashboard " +
      "and generation will show a setup notice. Set these and redeploy \u2014 the " +
      "NEXT_PUBLIC_ values are compiled into the browser bundle, so a rebuild is " +
      "required, not just a restart."
  );
}

if (failed) process.exit(1);

console.log("UFO static preflight passed.");
