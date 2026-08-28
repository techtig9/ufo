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
console.log("UFO static preflight passed.");
