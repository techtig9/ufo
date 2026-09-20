# Phase 4 — product features, collaboration, publishing, storage

Executed against `UFO_TechTig_Master_Command_v2.md` Phase 4.

Phase records: `PHASE1_UPGRADE_NOTES.md`, `PHASE2_NOTES_V2.md`,
`PHASE3_NOTES_V2.md`, this file. (`PHASE3_NOTES.md` belongs to an earlier,
differently-numbered effort and is historical.)

---

## How to re-run

```bash
npm audit && npm run typecheck && npm run lint && npm run build
npm test              # 170 unit
npm run test:db       # 78 database assertions
./supabase/tests/concurrency_test.sh
npm run preflight

npm run build && npm run start &
BASE=http://localhost:3000 npm run test:browser
```

`test:browser` runs six suites: behaviour, responsive, accessibility,
contrast, command palette, and **inspector**.

Migrations **010–013** are added in this phase. Apply them with
`npm run db:apply` and confirm with `npm run db:verify`, which now covers
Phase 4 as well.

---

## What was built

### Workspaces, roles and invitations (migration 010)

Workspaces with four roles — owner, admin, editor, viewer — plus membership,
invitations and an activity feed. The rank order is duplicated in SQL
(`workspace_role_rank`) because RLS must answer "at least editor?" without a
round trip to the app; the unit tests assert the two against each other so
they cannot drift apart silently.

`lib/workspaces.ts` imports node:crypto for invite tokens, so the pure role
vocabulary was split into **`lib/workspace-roles.ts`** — no imports at all —
to keep node crypto out of the browser bundle. Same pattern as
`lib/auth-event-types.ts`.

An invite token is a bearer credential and is treated like a password:
CSPRNG-generated, returned to the caller exactly once, stored only as a
SHA-256 hash. A forwarded link cannot be redeemed by whoever receives it —
the invited address must match the signed-in account.

**UI, because a backend with no way to reach it is a dead interaction:**
`/dashboard/workspaces`, the workspace detail page (members, invitations,
projects, activity, rename, delete), and **`/invite`** — which the invitation
email already linked to and which did not exist.

Two adjacent bugs fixed on the way:

- **Signup ignored `?next=` entirely.** Any flow sending a new user there to
  finish something came back to the wrong place. It now honours it through
  the same open-redirect guard login uses.
- **The project page filtered by `user_id`**, so the workspace collaborators
  RLS now grants would have got a 404 on projects they can legitimately open.

### Share permissions (migration 010)

Expiry, password and allow-comments on a share link, with the editor UI to
set them.

Enforcement lives in the **database**, not the route: an expired or
password-protected share is unreadable through the public anon key, so the
settings hold even against someone querying PostgREST directly rather than
using the app. The unlock endpoint is IP-rate-limited and returns one
identical denial for every failure mode, so it cannot be used to probe which
slugs exist. A password-protected prototype withholds its name from link
previews, because unfurling happens without the password.

### Comment mentions, assignment and activity (migration 011)

Mentions are stored as `@[Name](uuid)` tokens rather than bare `@name`.
Resolving by display name means guessing who was meant, and a display name is
neither unique nor stable — two people called "Ada", or someone renaming
themselves to match a colleague, would both misdirect a notification. Bodies
render as React text segments, never HTML.

The rule the server enforces: **a mention may only ever reach someone who can
already see the project.** The comment endpoint is deliberately open to
anonymous visitors of a public share — that is the point of a share link — so
without that check a visitor could paste any user id into a token and make
UFO email a stranger, with attacker-chosen text, from UFO's own domain.
`comment_mentions` has no client write policy at all, asserted for anon *and*
for an authenticated workspace editor.

**Two holes found while testing this:**

| Hole | Fix |
|---|---|
| `allow_comments` only hid the composer; the endpoint accepted posts regardless | checked server-side |
| RLS is row-level, so letting a viewer *resolve* a comment also let them PATCH its `body` through PostgREST and rewrite anyone's feedback | column-level UPDATE grants limit clients to the review columns — which also closes the same gap for the pre-existing owner policy, under which a project owner could silently edit a guest's words |

### Project assets on Supabase Storage (migration 012)

There was no Storage usage in the project at all, while the pricing page
already sold "10 GB cloud storage" on Pro. The plan cards now quote
`PLAN_STORAGE_BYTES`, so the page cannot advertise a limit the quota check
does not enforce.

Both halves are secured, because either alone is a hole: metadata rows
without object policies means anyone holding the anon key can download any
file by guessing a path; object policies without metadata means nothing can
be listed, renamed or counted against a quota.

Uploads are two-step — the server validates and reserves the space with a
`pending` row, then returns a signed upload URL the browser PUTs to directly.
Streaming 25 MB through a serverless function is not viable. Quota counts
pending rows deliberately, so two uploads racing cannot both pass a check
that neither would pass once the other landed.

Decisions worth stating:

- The bucket is **private**; files are served through 1-hour signed URLs. A
  public bucket makes every file readable by URL forever, including a
  client's unreleased designs.
- SVG and PDF are allowed (logos are a stated use case) but served with a
  forced download — both are documents a browser will execute or navigate
  rather than render inertly, so serving one from the app origin would be
  stored XSS.
- Object keys are built from ids only, never from the filename.
- Size and MIME limits are set **on the bucket** as well as in the app,
  because the browser uploads straight to Storage and a modified client never
  runs the app's validation.

### Layers and visual inspector

Select an element in the preview or the layer list and edit typography,
colours, spacing, borders, radius, shadows and flex layout. Multi-select edits
several at once; a property is shown only when the selection agrees on it.

**Inline styles, not Tailwind classes.** The markup is Tailwind-classed, but
arbitrary values — a 13px font, a `#3A7BD5` border — mostly have no class, so
a class-editing inspector would silently drop half of what is typed.

Selection crosses the sandbox by postMessage: the preview iframe is sandboxed
*without* `allow-same-origin` specifically so a prototype cannot reach the
parent, so the path is computed inside the frame and sent out, and the parent
validates the origin and the path's shape. The agent is injected only when
the editor asks for it, so a share-link visitor never has clicks intercepted.

Every write goes through `setStyleDeclaration`, which refuses any property
outside the catalogue and any value that could escape the attribute.

**Stated as unavailable in the panel rather than stubbed:** drag-to-reorder,
extracting reusable components, and binding a value to a design token.

### Publishing (migration 013)

The Master Command gates its publishing list on *"if real hosting is
implemented"*. **UFO does not host.** Publishing makes a link live at
`/proto/<slug>` on UFO's own domain. Custom domains, SSL, subdomains and
deployment rollback are named as unavailable in the panel, with the reason.

What is real is built: a publish log (who, when, and the settings then in
force), prototype view analytics, publish status, and an Open Graph card for
prototype links — generic for a protected or expired one, since unfurling
happens without the password.

**Analytics stores nothing identifying:** no IP address raw or hashed, no
user agent string, no session id — only the time, a coarse device bucket, and
the referrer's *host*, never its full URL. A per-visitor identifier is exactly
what turns analytics into personal data, and "is anyone looking at this?"
does not need one. That is why it needs no cookie. The panel says "views, not
visitors", because without an identifier repeat visits cannot be told apart.

### Legal copy corrected to match reality

Three real problems, all shipped to production pages:

1. **Privacy and Terms named "Google Gemini"** as the model provider. The code
   has used a Groq → Cerebras → OpenRouter → Anthropic cascade since Phase 2.
   Naming who receives customer data is a disclosure obligation, so the list
   now comes from `lib/subprocessors.ts` and **a test asserts it equals the
   router's actual cascade**.
2. **The Cookie Policy advertised an "Analytics" cookie category that does not
   exist**, and shipped an instruction-to-self to production: *"Configure your
   analytics provider's consent mode … before launch."*
3. **`@google/generative-ai` was still a dependency**, imported nowhere.
   Removed.

---

## Bugs found and fixed in my own work

- **`/contact` hydration mismatch (React #418).** It was a client component
  calling `companyValue()`, which reads a non-`NEXT_PUBLIC_` variable — so it
  rendered the real value during SSR and `— not set —` in the browser, on
  every load, breaking the theme class at nine breakpoints. It had passed
  earlier only because the variables were unset on both sides and therefore
  happened to agree. The first fix was **incomplete**: `Footer` is a server
  component that also calls `companyValue`, and rendering it from the client
  form pulled it into the client bundle, reproducing the same mismatch. The
  guard test is therefore **transitive**, and was verified to fail when
  `Footer` is re-imported.
- **A dead branch in the comments panel**: a read-only "Assigned to X" label
  that could never resolve a name, because a guest has no collaborator list.
  Removed rather than shipped.
- **Two type errors in my own asset tests**, caught only by
  `npm run typecheck` — which checks `tsconfig.tests.json` too, unlike a bare
  `tsc --noEmit`.
- **A miscounted path in my own inspector test** (`0.2.1` for an element at
  `0.1.1`). The code was right; the assertion was wrong.

---

## Verification results

| Gate | Result |
|---|---|
| `npm audit` | **0 vulnerabilities** |
| `npm run typecheck` | **0 errors** (both tsconfigs) |
| `npm run lint` | **0 errors**, 11 warnings |
| `npm run build` | **passes** |
| `npm test` | **170 / 170** (was 68 at end of Phase 3) |
| `npm run test:db` | **78 assertions** (was 31) |
| `concurrency_test.sh` | passes |
| `npm run db:verify` | **26 failed / 5 passed** before the migrations → **0 failed / 31 passed** after, applying the real `apply-migrations.sh` to a database in current production state; a second run is a clean no-op |
| `npm run preflight` | passes |
| Behaviour suite | **13 / 13** |
| Responsive | **180 combinations**, 0 failures |
| Accessibility | **12 / 12** |
| Contrast | **22 combinations**, AA in both themes |
| Command palette | **7 / 7** |
| **Inspector** | **17 / 17** |
| New API routes | 12 endpoints checked: every authenticated route returns 401 signed out; the collaborator list returns an empty set rather than an error |

---

## Remaining risks

1. **Migrations 007–013 are still unapplied.** Nothing in Phases 1–4 that
   depends on the database is live until `npm run db:apply` runs.
2. **Nothing has been verified against a live service.** No Supabase, Resend,
   Paddle, Google OAuth or AI provider credentials exist in this environment.
   A real invitation email, mention email, password-gated visit, file upload,
   signed download, recorded view and publish-log write are **unverified and
   not claimed**.
3. **Authenticated routes are still not visually measured.** The responsive,
   contrast and a11y sweeps cover 10 public routes. The dashboard, editor,
   workspace pages, billing and settings use the same tokens — inference, not
   measurement.
4. **The Storage policies are proven against a stand-in, not Supabase.** The
   test harness gained a minimal `storage` schema so migration 012's policy
   block runs and is exercised as the real anon/authenticated roles. That
   proves the SQL is valid and the authorisation logic is right; it does not
   prove Supabase's Storage API enforces them identically.
5. **Company details are unset** in any real environment. CI fails until they
   are filled — deliberately.
6. **Carried:** `@supabase/ssr` is still 0.4.1 (the `cookie` advisory is
   neutralised by an npm override, so `npm audit` is clean); two editor
   components keep a scoped `react-hooks` lint relaxation; no Figma-derived
   design foundation, because the connector still exposes only Figma's own
   skills and docs.
