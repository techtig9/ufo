-- UFO Phase 3: AI edit history + real template content
-- Run after 001/002/003. Purely additive — does not touch existing rows.

-- Lets a version row record *why* it was created: the AI instruction that produced the
-- next state (source='ai'), or a plain manual code-editor save (source='manual', default).
-- Backs persistent AI conversation history (spec Section 36) by reusing the existing
-- version mechanism instead of a parallel chat-log table.
alter table screen_versions add column if not exists instruction text;
alter table screen_versions add column if not exists source text not null default 'manual';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'screen_versions_source_check'
  ) then
    alter table screen_versions add constraint screen_versions_source_check
      check (source in ('manual', 'ai'));
  end if;
end $$;

-- Templates previously had no content to actually start a project from (category/name/
-- thumbnail only) — "Use this template" had nothing to copy. `screens` holds an array of
-- {name, code} objects, same shape `POST /api/projects/:id/screens` already accepts.
alter table templates add column if not exists description text;
alter table templates add column if not exists screens jsonb;

-- Needed so the seed insert below is safely re-runnable (ON CONFLICT target).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'templates_name_key'
  ) then
    alter table templates add constraint templates_name_key unique (name);
  end if;
end $$;

-- Three real starter templates so "Use this template" is genuinely functional end to end.
-- This is a starting set, not the full ten-category gallery the spec describes — the rest
-- is content-authoring work (writing real HTML per category), not a schema/engineering gap.
insert into templates (category, name, description, screens)
values
  (
    'saas',
    'SaaS Landing',
    'A single-page SaaS marketing site: hero, feature grid, and pricing.',
    '[
      {"name": "Home", "code": "<main class=\"min-h-screen bg-white text-slate-900\"><section class=\"px-6 py-20 text-center\"><p class=\"text-xs font-semibold uppercase tracking-widest text-indigo-600\">Launch faster</p><h1 class=\"mx-auto mt-3 max-w-2xl text-4xl font-bold sm:text-5xl\">Ship your SaaS product in days, not months</h1><p class=\"mx-auto mt-4 max-w-xl text-slate-500\">A starting point you can reshape with the AI Designer — swap the copy, colors, and sections to match your product.</p><div class=\"mt-8 flex justify-center gap-3\"><a data-hotspot=\"Pricing\" class=\"rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white\">See pricing</a><a class=\"rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold\">Watch demo</a></div></section><section class=\"grid gap-6 border-t border-slate-100 px-6 py-16 sm:grid-cols-3\"><div class=\"rounded-xl border border-slate-100 p-6\"><h3 class=\"font-semibold\">Fast setup</h3><p class=\"mt-2 text-sm text-slate-500\">Get from idea to a working product page in minutes.</p></div><div class=\"rounded-xl border border-slate-100 p-6\"><h3 class=\"font-semibold\">Built to convert</h3><p class=\"mt-2 text-sm text-slate-500\">Clear hierarchy and a focused call to action.</p></div><div class=\"rounded-xl border border-slate-100 p-6\"><h3 class=\"font-semibold\">Fully editable</h3><p class=\"mt-2 text-sm text-slate-500\">Every section is plain HTML and Tailwind you can edit.</p></div></section></main>"},
      {"name": "Pricing", "code": "<main class=\"min-h-screen bg-white px-6 py-20 text-slate-900\"><h1 class=\"text-center text-3xl font-bold\">Simple, transparent pricing</h1><div class=\"mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2\"><div class=\"rounded-xl border border-slate-200 p-6\"><h3 class=\"font-semibold\">Starter</h3><p class=\"mt-2 text-3xl font-bold\">$19<span class=\"text-base font-normal text-slate-400\">/mo</span></p><a data-hotspot=\"Home\" class=\"mt-6 block rounded-lg border border-slate-200 py-2 text-center text-sm font-semibold\">Back to home</a></div><div class=\"rounded-xl border-2 border-indigo-600 p-6\"><h3 class=\"font-semibold\">Pro</h3><p class=\"mt-2 text-3xl font-bold\">$49<span class=\"text-base font-normal text-slate-400\">/mo</span></p><a data-hotspot=\"Home\" class=\"mt-6 block rounded-lg bg-indigo-600 py-2 text-center text-sm font-semibold text-white\">Back to home</a></div></div></main>"}
    ]'::jsonb
  ),
  (
    'portfolio',
    'Personal Portfolio',
    'A minimal portfolio with a work grid and a contact section.',
    '[
      {"name": "Home", "code": "<main class=\"min-h-screen bg-[#0b0b0f] text-white\"><section class=\"px-6 py-24\"><p class=\"text-xs uppercase tracking-widest text-white/40\">Product designer</p><h1 class=\"mt-3 text-4xl font-bold\">Hi, I make digital products people enjoy using</h1><a data-hotspot=\"Contact\" class=\"mt-6 inline-block rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black\">Get in touch</a></section><section class=\"grid gap-4 px-6 pb-24 sm:grid-cols-3\"><div class=\"aspect-square rounded-xl bg-white/5\"></div><div class=\"aspect-square rounded-xl bg-white/5\"></div><div class=\"aspect-square rounded-xl bg-white/5\"></div></section></main>"},
      {"name": "Contact", "code": "<main class=\"flex min-h-screen items-center justify-center bg-[#0b0b0f] px-6 text-white\"><div class=\"w-full max-w-sm text-center\"><h1 class=\"text-2xl font-bold\">Let''s work together</h1><p class=\"mt-2 text-sm text-white/50\">Reach out and I''ll get back to you within a day.</p><a data-hotspot=\"Home\" class=\"mt-6 inline-block rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold\">Back to home</a></div></main>"}
    ]'::jsonb
  ),
  (
    'business',
    'Small Business',
    'A local-business site with services and a contact page.',
    '[
      {"name": "Home", "code": "<main class=\"min-h-screen bg-white text-slate-900\"><section class=\"bg-slate-900 px-6 py-24 text-center text-white\"><h1 class=\"text-4xl font-bold\">Quality work, done right</h1><p class=\"mx-auto mt-3 max-w-md text-slate-300\">Trusted by families and businesses in your area for over a decade.</p><a data-hotspot=\"Services\" class=\"mt-6 inline-block rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900\">Our services</a></section></main>"},
      {"name": "Services", "code": "<main class=\"min-h-screen bg-white px-6 py-20 text-slate-900\"><h1 class=\"text-3xl font-bold\">Services</h1><div class=\"mt-8 grid gap-4 sm:grid-cols-2\"><div class=\"rounded-xl border border-slate-100 p-6\"><h3 class=\"font-semibold\">Consultation</h3><p class=\"mt-2 text-sm text-slate-500\">A free first visit to scope the work.</p></div><div class=\"rounded-xl border border-slate-100 p-6\"><h3 class=\"font-semibold\">Full service</h3><p class=\"mt-2 text-sm text-slate-500\">End-to-end delivery with a fixed quote.</p></div></div><a data-hotspot=\"Home\" class=\"mt-8 inline-block text-sm font-semibold text-slate-500\">← Back to home</a></main>"}
    ]'::jsonb
  )
on conflict (name) do nothing;
