# Phase 3 — Frontend / UI / UX

Executed against `UFO_TechTig_Master_Command_v2.md` Phase 3 and its frontend
appendix.

> `PHASE3_NOTES.md` belongs to an earlier, differently-numbered effort and is
> historical. Phase records: `PHASE1_UPGRADE_NOTES.md`, `PHASE2_NOTES_V2.md`,
> this file.

---

## How to re-run

```bash
npm audit && npm run typecheck && npm run lint && npm run build
npm test            # 68 unit
npm run test:db     # 31 database assertions
npm run preflight   # warns locally, FAILS in CI while company details are unset

npm run build && npm run start &
BASE=http://localhost:3000 npm run test:browser
```

`test:browser` runs five suites: behaviour, responsive, accessibility,
**contrast**, and command palette.

---

## The token layer

Before Phase 3: **zero CSS custom properties** and **~580 hardcoded
white-based utilities**. Light mode was held together by a block that remapped
thirteen specific `text-white/NN` opacities to ink — so any new opacity was
invisible on paper, and `bg-white/5` surfaces were never remapped at all,
making a "surface" white on white.

`app/globals.css` now defines semantic variables for surfaces (four elevation
tiers), borders, four text steps, brand, status, radius and the spec's motion
tiers, each with a light counterpart. Tailwind maps them so components name the
**role** — `bg-surface`, `border-edge`, `text-fg-muted`.

**602 utilities migrated across 73 files.** The opacity buckets were a judgment
made once: the old palette used opacity as a de facto type scale
(`text-white/40` = faint label, `/70` = body), so each band maps to the semantic
step that carried that meaning.

The palette keeps UFO's Studio Grid identity — ink, paper, citron, coral,
indigo — rather than the spec's generic violet. That vocabulary is the
product's only real visual differentiation; the spec contributes the
*structure*.

## Contrast: measured, not asserted

`tests/browser/contrast.mjs` walks every rendered text node across 8 routes × 2
themes, composites the effective background through transparent ancestors, and
computes the real WCAG ratio against the size/weight threshold.

**First run: 181 failures. Final: 0.**

| Root cause | Fix |
|---|---|
| `--fg-muted` / `--fg-faint` sat at 3.5–4.1 in both themes | retuned until all four steps clear 4.5 on `--canvas` *and* `--surface` |
| citron measured **1.1:1** and coral **3.1:1** on paper | brand colours used as *text* got their own `--brand-text` / `--accent-text` / `--accent-alt-text`, darkened in light mode; brand *fills* stay citron/coral with ink text |
| `text-violet-300` eyebrows had no light counterpart | adaptive token |

Two regressions the test caught **in the migration itself**: `text-white` on a
fixed slate-900 fill became `text-fg` (ink in light mode — the label vanished);
and chips over project thumbnails were themed when they overlay *imagery*, so
they now keep a dark scrim with fixed white text, the way a caption over a
photo does.

One false positive was corrected in the test rather than worked around:
gradient headings paint through `background-clip:text`, so their computed
colour is transparent and a naive ratio reads 1:1.

## Command palette — replacing a dead control

The top bar rendered a search field advertising ⌘K whose handler, for both
click and shortcut, was `router.push('/dashboard/projects')`. No palette, no
search.

Now real: global ⌘/Ctrl+K, arrow keys, Enter, Escape, focus trap and restore,
full combobox semantics (`role="listbox"`, `aria-activedescendant`, active row
scrolled into view). Navigation and actions are static; project results come
from `GET /api/projects/search`, read through the caller's session so RLS
scopes it, fetched lazily on first open.

Editor shortcuts (Cmd/Ctrl+Z, Shift+Z, Escape) are wired to the undo/redo
stacks that existed but had no bindings — deliberately inert while focus is in
a text field or Monaco.

## AI Designer — three regions

Was a centred `max-w-3xl` wizard; now left brief / centre canvas / right
screens and guidance, with a top bar for project, cost and live state.

The wizard is **unchanged** — it works and is credit-gated — so it was
re-framed, not rewritten. It reports its state upward so the user sees their
real selections while making them.

**On honest progress:** the spec forbids fake percentages. `/api/generate` is a
single request/response, so the only progress the backend genuinely exposes is
sent and finished. The centre shows real elapsed seconds; the five pipeline
steps are presented as *an explanation of what generation does*, deliberately
not a tracker. Making them live requires streaming, which is not built and is
not pretended.

## Motion and component states

The spec's tiers are tokens (`--motion-micro/standard/overlay/reveal`) mapped
through Tailwind, so a component picks an intent rather than inventing a
duration.

`Button` gained a real `loading` state: it disables, sets `aria-busy`, and
overlays a spinner while keeping the label in flow so the button does not
change width — the old `{loading ? 'Saving…' : 'Save'}` pattern reflowed
everything around it. Every variant has hover, active/pressed and focus; md/lg
meet the 44px touch target.

## Lint relaxations retired

Four of the six components exempted during the Phase 1 framework upgrade are
fixed and removed. Both fixes are structural, not suppressions:

- **loading is derived** from the data instead of tracked in a second state
  that had to be set synchronously in an effect — which also makes the two
  impossible to disagree.
- **version history stores rows paired with their screen**, so staleness is
  derived, switching screens needs no reset, and the panel can never briefly
  show another screen's history.

New code — the command palette — was written to satisfy the strict rules with
**no** relaxation.

## Placeholder copy

Nine files shipped `[Your Name / Agency Name]`, `[your contact email]`,
`[date]`, `[your jurisdiction]` to production pages, including Terms and
Privacy. The Master Command forbids placeholder copy and requires real company
information.

These are now centralised in `lib/company.ts` — **not invented**. A legal entity
name, jurisdiction and contact address are facts only you can supply, and
fabricating them on legal pages would be worse than an obvious gap. An unset
field renders as `— not set —` rather than a raw token, and `npm run preflight`
**warns locally and fails in CI** while any remains unset.

---

## Verification results

| Gate | Result |
|---|---|
| `npm audit` | **0 vulnerabilities** |
| `npm run typecheck` | **0 errors** |
| `npm run lint` | **0 errors**, 11 warnings (was 14) |
| `npm run build` | **passes** |
| `npm test` | **68 / 68** |
| `npm run test:db` | **31 assertions** |
| Behaviour suite | **13 / 13** |
| Responsive | **126 combinations**, 0 failures |
| Accessibility | **12 / 12** |
| **Contrast** | **181 → 0**, AA in both themes |
| Command palette | **7 / 7** |

---

## Remaining risks

1. **Company details are unset.** Terms, Privacy, Refunds, Cookies, the footer
   and contact all need real values in `lib/company.ts`. CI fails until then —
   deliberately.
2. **Two components keep the scoped lint relaxation**
   (`ai-design-copilot`, `code-editor-panel`, `generator-form`,
   `prototype-viewer`): the editor cannot be exercised without credentials
   here, and refactoring it blind would risk working functionality.
3. **Authenticated routes are not visually verified.** The contrast,
   responsive and a11y sweeps cover the 8 public routes. Dashboard, projects,
   editor, billing, settings and admin need a session this environment does not
   have — their markup uses the same tokens, but that is inference, not
   measurement.
4. **No Figma-derived foundation.** The connector exposes only Figma's own
   skills and docs — no design files — and every read tool needs a `fileKey`.
   The token layer is the code-side foundation proposed in the audit and
   approved. Send file URLs if you want it re-derived from a real design system.
5. **Carried:** migrations 007–009 unapplied; `@supabase/ssr` still 0.4.1
   (advisory neutralised by an override).
