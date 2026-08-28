import { Panel } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';

export function Help() {
  return (
    <section id="help" className="relative mx-auto max-w-5xl px-6 py-24">
      <Reveal>
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Help</h2>
      </Reveal>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <Reveal delay={0}>
          <Panel className="h-full">
            <h3 className="font-medium">How it works</h3>
            <ul className="mt-3 space-y-3 text-sm text-white/60">
              <li>You describe the project you want — its name, purpose, and project type (website, mobile app, dashboard, landing page, or e-commerce).</li>
              <li>ufo&rsquo;s AI asks a short, fixed sequence of multiple-choice follow-up questions — target device(s), design style, core screens, navigation pattern, color theme, and font pairing — so you&rsquo;re picking options, not writing everything out.</li>
              <li>The AI generates a full set of linked screens with a shared design system — color tokens, font tokens, spacing scale — matching your answers, with real spacing and hierarchy rather than generic, lorem-ipsum-looking placeholders.</li>
              <li>You review it instantly in the live prototype viewer: click through linked screens on a device-frame preview, just like a real clickable prototype.</li>
            </ul>
          </Panel>
        </Reveal>

        <Reveal delay={80}>
          <Panel className="h-full">
            <h3 className="font-medium">How to use it</h3>
            <ul className="mt-3 space-y-3 text-sm text-white/60">
              <li>Sign up (or log in with Google) and go to AI Designer in your dashboard.</li>
              <li>Enter your project&rsquo;s name and a description of what it&rsquo;s for.</li>
              <li>Answer the short multiple-choice follow-up questions.</li>
              <li>Click Generate and watch your screens build in the live prototype viewer, with click-through hotspots linking them together.</li>
              <li>Open the Design Handoff panel to pull the color palette, font stack, and spacing scale as a copyable spec sheet.</li>
              <li>Fine-tune any screen directly in the built-in code editor, then export as a ZIP (HTML/CSS source + PNG snapshots + a style guide) or publish a shareable prototype link with its own QR code for clients and stakeholders.</li>
            </ul>
          </Panel>
        </Reveal>

        <Reveal delay={160}>
          <Panel className="h-full">
            <h3 className="font-medium">What it provides</h3>
            <ul className="mt-3 space-y-3 text-sm text-white/60">
              <li>A complete, polished multi-screen UI/UX design generated from a plain-language description — no design software required, but full code access if you want it.</li>
              <li>A real clickable prototype (not a static mockup) with device-frame chrome, a Design Handoff spec sheet, a Monaco-powered code editor, and one-click ZIP export.</li>
              <li>A growing library of starter templates across project types — enough at launch to validate the generator, with more added over time.</li>
              <li>A wired-up &ldquo;Export to Figma&rdquo; action today — real Figma REST API integration arrives in Phase 2 once OAuth app review is complete.</li>
            </ul>
          </Panel>
        </Reveal>
      </div>
    </section>
  );
}
