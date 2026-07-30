import { Nav } from '@/components/landing/nav';
import { Footer } from '@/components/landing/footer';
import { Panel } from '@/components/ui/panel';

const ENTRIES = [
  {
    version: 'v0.1',
    date: '[launch date]',
    title: 'Initial release',
    items: [
      'AI Designer: describe a project, answer a few multiple-choice questions, get a full clickable prototype',
      'Live prototype viewer with device-frame preview and click-through hotspots',
      'Design Handoff spec sheet, built-in code editor, ZIP export',
      'Shareable prototype links with QR codes and stakeholder comments',
      'Starter, Pro, and Business plans',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-wider text-studio-citron">Changelog</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">What&rsquo;s new</h1>
        <p className="mt-2 text-white/50">Every shipped change, newest first.</p>

        <div className="mt-10 space-y-6">
          {ENTRIES.map((e) => (
            <Panel key={e.version} hover={false}>
              <div className="flex items-baseline gap-3">
                <span className="rounded border border-studio-citron/40 px-2 py-0.5 font-mono text-xs text-studio-citron">
                  {e.version}
                </span>
                <span className="text-xs text-white/40">{e.date}</span>
              </div>
              <h2 className="mt-3 font-display text-lg font-medium">{e.title}</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-white/60">
                {e.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-studio-coral" />
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
