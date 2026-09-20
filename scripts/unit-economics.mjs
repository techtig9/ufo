#!/usr/bin/env node
/**
 * Unit economics: what each plan can cost us in AI, against what it charges.
 *
 * Two analyses, because they answer different questions:
 *
 *   WORST CASE   what a plan costs if a user spends every credit on the most
 *                token-expensive action available. Needs no production data,
 *                so it can be run before launch — and it is the number that
 *                decides whether a plan is safe to sell at all.
 *
 *   ACTUAL       measured from ai_requests, when DATABASE_URL is set. What
 *                people really do, which is always cheaper than the worst
 *                case, and is the number to price against once you have it.
 *
 * Usage:
 *   node scripts/unit-economics.mjs                     # worst case only
 *   DATABASE_URL='postgresql://...' node scripts/unit-economics.mjs   # both
 *
 * Run it whenever plan prices, credit costs, model choices or provider rates
 * change — those are four independent ways for a plan to go underwater.
 */
import { execFileSync } from 'node:child_process';

const { PLAN_MONTHLY_CREDITS, PLAN_PRICE_USD, CREDIT_COSTS } = await import('../lib/credits.ts');
const { estimateCostUsd } = await import('../lib/ai/cost.ts');

/**
 * Output-token ceiling per action, from the maxTokens passed at each call site
 * in lib/ai.ts. These are BOUNDS, not measurements: a real call usually
 * returns well under its ceiling. Prompt size is estimated from the same
 * ceiling, because a regenerate sends the existing screen back in.
 */
const MAX_OUTPUT_TOKENS = {
  generate_full_project: 8000,
  import_redesign: 8000,
  generate_component: 8000,
  generate_screen: 4000,
  regenerate_screen: 4000,
  regenerate_project: 8000,
  change_theme: 1000,
  update_screen: 4000,
  improve_ux: 4000,
  improve_copy: 4000,
  make_responsive: 4000,
  improve_accessibility: 4000,
  audit_accessibility: 2000,
  check_consistency: 2000,
  extract_design_system: 2000,
  export_figma: 2000,
  voice_transcription: 500,
};

// The cascade's expensive tier. Worst case means assuming the cheap providers
// are down — which is exactly when a cost surprise happens.
const WORST_MODEL = process.env.WORST_MODEL || 'claude-fable-5';

const money = (n) => `$${n.toFixed(2)}`;

function worstCasePerCredit() {
  let worst = { action: null, perCredit: 0 };

  for (const [action, credits] of Object.entries(CREDIT_COSTS)) {
    const outputTokens = MAX_OUTPUT_TOKENS[action];
    if (!outputTokens || !credits) continue;

    // Prompt assumed equal to the output ceiling: a rewrite sends the screen
    // in and gets a screen out.
    const cost = estimateCostUsd(WORST_MODEL, outputTokens, outputTokens);
    const perCredit = cost / credits;
    if (perCredit > worst.perCredit) worst = { action, perCredit, cost, credits };
  }

  return worst;
}

const worst = worstCasePerCredit();

console.log(`\nWORST CASE — every credit spent on the most expensive action`);
console.log(`Model assumed: ${WORST_MODEL} (the cascade's fallback tier)`);
console.log(`Most expensive per credit: ${worst.action} — ${money(worst.cost)} for ${worst.credits} credits\n`);

const rows = [];
let anyNegative = false;

for (const plan of ['free', 'starter', 'pro', 'business']) {
  const credits = PLAN_MONTHLY_CREDITS[plan];
  const price = PLAN_PRICE_USD[plan];
  const cost = credits * worst.perCredit;
  const margin = price - cost;
  const marginPct = price > 0 ? (margin / price) * 100 : null;

  // Free is SUPPOSED to cost money — it has no revenue by design, so counting
  // it as a failure would make this check cry wolf on every run and get
  // ignored. Only a paid plan underwater is a problem.
  if (margin < 0 && price > 0) anyNegative = true;
  rows.push({ plan, credits, price, cost, margin, marginPct });
}

console.log('plan       credits    price     worst AI cost   margin      margin %');
for (const r of rows) {
  const flag = r.margin < 0 ? '  <-- NEGATIVE' : '';
  console.log(
    `${r.plan.padEnd(10)} ${String(r.credits).padStart(7)}  ${money(r.price).padStart(7)}  ` +
      `${money(r.cost).padStart(14)}  ${money(r.margin).padStart(9)}  ` +
      `${(r.marginPct === null ? 'n/a' : `${r.marginPct.toFixed(0)}%`).padStart(8)}${flag}`
  );
}

console.log(`
Free has no revenue, so its "margin" is simply its cost — the number that
matters there is cost per free user per month, and whether conversion pays for
it. Treat the paid rows as a floor: a plan that survives this survives anything.
`);

if (process.env.DATABASE_URL) {
  console.log('ACTUAL — measured from ai_requests (last 30 days)\n');
  try {
    const sql = `
      select coalesce(model, '(unknown)') as model,
             count(*) as calls,
             coalesce(sum(prompt_tokens), 0) as prompt_tokens,
             coalesce(sum(completion_tokens), 0) as completion_tokens,
             count(distinct user_id) as users
        from ai_requests
       where created_at > now() - interval '30 days'
       group by 1 order by 2 desc;`;
    const out = execFileSync('psql', [process.env.DATABASE_URL, '-A', '-F\t', '-t', '-c', sql], {
      encoding: 'utf8',
    });

    let total = 0;
    let users = 0;
    for (const line of out.trim().split('\n').filter(Boolean)) {
      const [model, calls, prompt, completion, u] = line.split('\t');
      const cost = estimateCostUsd(model, Number(prompt), Number(completion));
      total += cost;
      users = Math.max(users, Number(u));
      console.log(`  ${model.padEnd(36)} ${calls.padStart(6)} calls  ${money(cost).padStart(10)}`);
    }

    console.log(`\n  total ${money(total)} across ${users} active user(s)`);
    if (users > 0) console.log(`  cost per active user: ${money(total / users)}`);
    console.log('\n  Compare that against your plan prices above. If cost per active user');
    console.log('  approaches the price of the plan most of them are on, the pricing is');
    console.log('  wrong regardless of what the worst case says.\n');
  } catch (err) {
    console.log(`  Could not query the database: ${err.message}`);
    console.log('  (psql must be installed and DATABASE_URL reachable.)\n');
  }
} else {
  console.log('Set DATABASE_URL to also measure actual spend from ai_requests.\n');
}

// Credit pricing consistency: two actions with the same token ceiling should
// cost a similar number of credits. A large spread means one action is a much
// better deal than another for the same underlying work, which is how a
// power user finds the cheapest route to the same output.
console.log('CREDIT PRICING CONSISTENCY — cost per credit by action\n');
const perAction = Object.entries(CREDIT_COSTS)
  .filter(([action]) => MAX_OUTPUT_TOKENS[action])
  .map(([action, credits]) => {
    const t = MAX_OUTPUT_TOKENS[action];
    return { action, credits, tokens: t, perCredit: estimateCostUsd(WORST_MODEL, t, t) / credits };
  })
  .sort((a, b) => b.perCredit - a.perCredit);

const cheapest = perAction[perAction.length - 1];
for (const a of perAction.slice(0, 5)) {
  const ratio = a.perCredit / cheapest.perCredit;
  console.log(
    `  ${a.action.padEnd(26)} ${String(a.credits).padStart(5)} credits  ` +
      `${String(a.tokens).padStart(5)} max tokens  ${ratio.toFixed(1)}x the cheapest`
  );
}
console.log(
  `\n  Cheapest per credit: ${cheapest.action} ` +
    `(${cheapest.credits} credits for ${cheapest.tokens} max tokens)\n`
);
if (perAction[0].perCredit / cheapest.perCredit > 5) {
  console.log(
    `  WARNING: ${perAction[0].action} costs ${(perAction[0].perCredit / cheapest.perCredit).toFixed(0)}x ` +
      `more per credit than ${cheapest.action} for comparable token work.\n` +
      `  A user wanting the cheapest route to the same output will find it.\n`
  );
}

if (anyNegative) {
  console.log('At least one PAID plan has a negative worst-case margin.\n');
  process.exit(1);
}
