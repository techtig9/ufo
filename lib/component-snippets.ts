// Curated HTML/Tailwind snippets for the editor's "Insert component" palette
// (spec Section 15 — Component Library). These insert directly into the Monaco
// code editor, so they persist through the exact same save path as any other
// hand-edit — no separate persistence mechanism to fabricate.
export interface ComponentSnippet {
  id: string;
  name: string;
  html: string;
}

export const COMPONENT_SNIPPETS: ComponentSnippet[] = [
  {
    id: 'navbar',
    name: 'Navbar',
    html: `<nav class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
  <span class="font-bold">Brand</span>
  <div class="hidden gap-6 text-sm text-slate-600 sm:flex">
    <a href="#">Product</a><a href="#">Pricing</a><a href="#">About</a>
  </div>
  <a class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" href="#">Get started</a>
</nav>`,
  },
  {
    id: 'hero',
    name: 'Hero',
    html: `<section class="px-6 py-24 text-center">
  <h1 class="mx-auto max-w-2xl text-4xl font-bold sm:text-5xl">A clear, confident headline goes here</h1>
  <p class="mx-auto mt-4 max-w-xl text-slate-500">One supporting sentence explaining the value in plain language.</p>
  <div class="mt-8 flex justify-center gap-3">
    <a class="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white" href="#">Primary action</a>
    <a class="rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold" href="#">Secondary</a>
  </div>
</section>`,
  },
  {
    id: 'features',
    name: 'Features',
    html: `<section class="grid gap-6 px-6 py-16 sm:grid-cols-3">
  <div class="rounded-xl border border-slate-100 p-6"><h3 class="font-semibold">Feature one</h3><p class="mt-2 text-sm text-slate-500">A short benefit-driven description.</p></div>
  <div class="rounded-xl border border-slate-100 p-6"><h3 class="font-semibold">Feature two</h3><p class="mt-2 text-sm text-slate-500">A short benefit-driven description.</p></div>
  <div class="rounded-xl border border-slate-100 p-6"><h3 class="font-semibold">Feature three</h3><p class="mt-2 text-sm text-slate-500">A short benefit-driven description.</p></div>
</section>`,
  },
  {
    id: 'testimonials',
    name: 'Testimonials',
    html: `<section class="px-6 py-16">
  <div class="mx-auto max-w-xl rounded-xl border border-slate-100 p-6 text-center">
    <p class="text-lg text-slate-700">\u201cThis product changed how our team works \u2014 genuinely.\u201d</p>
    <p class="mt-4 text-sm font-semibold">Jordan Lee, Operations Lead</p>
  </div>
</section>`,
  },
  {
    id: 'pricing',
    name: 'Pricing',
    html: `<section class="px-6 py-16">
  <div class="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
    <div class="rounded-xl border border-slate-200 p-6"><h3 class="font-semibold">Starter</h3><p class="mt-2 text-3xl font-bold">$19<span class="text-base font-normal text-slate-400">/mo</span></p></div>
    <div class="rounded-xl border-2 border-slate-900 p-6"><h3 class="font-semibold">Pro</h3><p class="mt-2 text-3xl font-bold">$49<span class="text-base font-normal text-slate-400">/mo</span></p></div>
  </div>
</section>`,
  },
  {
    id: 'faq',
    name: 'FAQ',
    html: `<section class="mx-auto max-w-2xl px-6 py-16">
  <h2 class="text-2xl font-bold">Frequently asked questions</h2>
  <div class="mt-6 space-y-4">
    <div><p class="font-semibold">A common question?</p><p class="mt-1 text-sm text-slate-500">A clear, honest answer.</p></div>
    <div><p class="font-semibold">Another question?</p><p class="mt-1 text-sm text-slate-500">A clear, honest answer.</p></div>
  </div>
</section>`,
  },
  {
    id: 'cta',
    name: 'CTA banner',
    html: `<section class="mx-6 my-16 rounded-2xl bg-slate-900 px-8 py-14 text-center text-white">
  <h2 class="text-3xl font-bold">Ready to get started?</h2>
  <a class="mt-6 inline-block rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900" href="#">Start now</a>
</section>`,
  },
  {
    id: 'contact',
    name: 'Contact form',
    html: `<section class="mx-auto max-w-md px-6 py-16">
  <h2 class="text-2xl font-bold">Get in touch</h2>
  <form class="mt-6 space-y-3">
    <input class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Your name" />
    <input class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Email address" />
    <textarea class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows="4" placeholder="Message"></textarea>
    <button class="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white" type="button">Send message</button>
  </form>
</section>`,
  },
  {
    id: 'gallery',
    name: 'Gallery',
    html: `<section class="grid gap-3 px-6 py-16 sm:grid-cols-3">
  <div class="aspect-square rounded-xl bg-slate-100"></div>
  <div class="aspect-square rounded-xl bg-slate-100"></div>
  <div class="aspect-square rounded-xl bg-slate-100"></div>
</section>`,
  },
  {
    id: 'team',
    name: 'Team',
    html: `<section class="px-6 py-16">
  <h2 class="text-center text-2xl font-bold">Meet the team</h2>
  <div class="mt-8 grid gap-6 sm:grid-cols-3">
    <div class="text-center"><div class="mx-auto h-20 w-20 rounded-full bg-slate-100"></div><p class="mt-3 font-semibold">Alex Rivera</p><p class="text-xs text-slate-500">Co-founder</p></div>
    <div class="text-center"><div class="mx-auto h-20 w-20 rounded-full bg-slate-100"></div><p class="mt-3 font-semibold">Sam Okafor</p><p class="text-xs text-slate-500">Co-founder</p></div>
    <div class="text-center"><div class="mx-auto h-20 w-20 rounded-full bg-slate-100"></div><p class="mt-3 font-semibold">Priya Nair</p><p class="text-xs text-slate-500">Design lead</p></div>
  </div>
</section>`,
  },
  {
    id: 'stats',
    name: 'Stats',
    html: `<section class="grid gap-6 px-6 py-16 text-center sm:grid-cols-3">
  <div><p class="text-3xl font-bold">12k+</p><p class="mt-1 text-sm text-slate-500">Active users</p></div>
  <div><p class="text-3xl font-bold">99.9%</p><p class="mt-1 text-sm text-slate-500">Uptime</p></div>
  <div><p class="text-3xl font-bold">4.9/5</p><p class="mt-1 text-sm text-slate-500">Average rating</p></div>
</section>`,
  },
  {
    id: 'logo-cloud',
    name: 'Logo cloud',
    html: `<section class="px-6 py-12">
  <p class="text-center text-xs uppercase tracking-widest text-slate-400">Trusted by teams at</p>
  <div class="mt-6 flex flex-wrap items-center justify-center gap-8 opacity-50">
    <div class="h-6 w-24 rounded bg-slate-300"></div>
    <div class="h-6 w-24 rounded bg-slate-300"></div>
    <div class="h-6 w-24 rounded bg-slate-300"></div>
    <div class="h-6 w-24 rounded bg-slate-300"></div>
  </div>
</section>`,
  },
  {
    id: 'cards',
    name: 'Card grid',
    html: `<section class="grid gap-4 px-6 py-16 sm:grid-cols-2">
  <div class="rounded-xl border border-slate-100 p-5"><p class="font-semibold">Card title</p><p class="mt-1 text-sm text-slate-500">Supporting description text.</p></div>
  <div class="rounded-xl border border-slate-100 p-5"><p class="font-semibold">Card title</p><p class="mt-1 text-sm text-slate-500">Supporting description text.</p></div>
</section>`,
  },
  {
    id: 'footer',
    name: 'Footer',
    html: `<footer class="border-t border-slate-100 px-6 py-10 text-sm text-slate-500">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <span>\u00a9 2026 Your Company</span>
    <div class="flex gap-4"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a></div>
  </div>
</footer>`,
  },
];
