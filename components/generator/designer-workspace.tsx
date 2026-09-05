'use client';

import { useState } from 'react';
import { GeneratorForm } from '@/components/generator/generator-form';
import { CREDIT_COSTS } from '@/lib/credits';
import type { FollowUpAnswers } from '@/lib/types';

/**
 * The AI Designer workspace (spec: "AI Designer — signature UFO interface").
 *
 * Three regions: left prompt/context, centre live canvas, right screens and
 * guidance, with a top bar carrying the project and the generate state.
 *
 * The wizard itself is unchanged — it works, it is credit-gated, and its
 * submission path is covered by the generate route's reserve/refund. What
 * changed is the frame around it, and that the user can now see their real
 * selections while making them instead of only at the review step.
 *
 * On honest progress: the spec is explicit that "generation stages must reflect
 * real backend state. Never show fake percentages." /api/generate is a single
 * request/response, not a streaming job — so the only progress the backend
 * genuinely exposes is "sent" and "finished". The centre shows real elapsed
 * time and marks the pipeline steps as informational, never as tracked
 * progress. Making these live requires streaming, which is not built.
 */

interface WizardState {
  step: string;
  stepIndex: number;
  stepCount: number;
  projectName: string;
  description: string;
  answers: FollowUpAnswers;
  generating: boolean;
  elapsedSeconds: number;
}

const PIPELINE = [
  ['Understanding requirements', 'Reads your description, type and target devices.'],
  ['Planning information architecture', 'Decides what belongs on each screen.'],
  ['Designing screens', 'Writes the markup for every screen you listed.'],
  ['Applying the design system', 'Applies one palette, type scale and spacing scale.'],
  ['Preparing the prototype', 'Wires hotspots so screens link together.'],
] as const;

export function DesignerWorkspace({ canImport }: { canImport: boolean }) {
  const [state, setState] = useState<WizardState | null>(null);

  const answers = state?.answers;
  const screens = answers?.coreScreens ?? [];
  const swatch = answers?.colorTheme.brandHex;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-4 lg:px-6">
      {/* ---- Top bar ---------------------------------------------------- */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-surface px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-alt-text">
            UFO Studio
          </p>
          <h1 className="truncate font-display text-xl font-semibold">
            {state?.projectName?.trim() || 'New project'}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full border border-edge px-2.5 py-1 text-fg-muted">
            {CREDIT_COSTS.generate_full_project.toLocaleString()} credits
          </span>
          {state?.generating ? (
            <span
              role="status"
              aria-live="polite"
              className="flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 font-medium text-brand-text"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              Generating · {state.elapsedSeconds}s
            </span>
          ) : (
            <span className="rounded-full border border-edge px-2.5 py-1 text-fg-faint">
              Step {(state?.stepIndex ?? 0) + 1} of {state?.stepCount ?? 8}
            </span>
          )}
        </div>
      </header>

      {/* ---- Three regions ---------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)_minmax(0,300px)]">
        {/* LEFT — prompt and context */}
        <section aria-label="Project brief" className="min-w-0">
          <GeneratorForm canImport={canImport} embedded onStateChange={setState} />
        </section>

        {/* CENTRE — live canvas */}
        <section aria-label="Preview" className="min-w-0">
          <div className="dot-canvas flex min-h-[420px] flex-col rounded-xl border border-edge bg-canvas p-5 lg:min-h-[560px]">
            {state?.generating ? (
              <div className="m-auto w-full max-w-sm text-center">
                <div className="shimmer mx-auto mb-5 h-32 w-full rounded-xl" />
                <p className="font-medium">Generating your screens…</p>
                <p className="mt-1 text-sm text-fg-muted">
                  Usually 15–45 seconds for a full multi-screen project.
                </p>
                <p className="mt-3 font-mono text-xs text-fg-faint" role="status" aria-live="polite">
                  {state.elapsedSeconds}s elapsed
                </p>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
                  Live brief
                </p>

                <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
                  <h2 className="font-display text-lg font-semibold">
                    {state?.projectName?.trim() || 'Untitled project'}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-fg-muted">
                    {state?.description?.trim() ||
                      'Describe what you are building on the left. Everything you choose appears here as you go.'}
                  </p>

                  {answers && (
                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      <div>
                        <dt className="text-fg-faint">Type</dt>
                        <dd className="mt-0.5 capitalize text-fg-secondary">{answers.projectType}</dd>
                      </div>
                      <div>
                        <dt className="text-fg-faint">Style</dt>
                        <dd className="mt-0.5 capitalize text-fg-secondary">{answers.designStyle}</dd>
                      </div>
                      <div>
                        <dt className="text-fg-faint">Devices</dt>
                        <dd className="mt-0.5 text-fg-secondary">{answers.targetDevices.join(', ')}</dd>
                      </div>
                      <div>
                        <dt className="text-fg-faint">Navigation</dt>
                        <dd className="mt-0.5 text-fg-secondary">{answers.navigationPattern}</dd>
                      </div>
                      <div>
                        <dt className="text-fg-faint">Type pairing</dt>
                        <dd className="mt-0.5 text-fg-secondary">{answers.fontPairing}</dd>
                      </div>
                      <div>
                        <dt className="text-fg-faint">Colour</dt>
                        <dd className="mt-0.5 flex items-center gap-1.5 text-fg-secondary">
                          {swatch && (
                            <span
                              aria-hidden="true"
                              className="h-3 w-3 rounded-sm border border-edge"
                              style={{ background: swatch }}
                            />
                          )}
                          {swatch ?? answers.colorTheme.preset ?? 'Designer’s choice'}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>

                <div className="mt-4 rounded-xl border border-edge bg-surface p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
                    What generation does
                  </p>
                  {/* Informational, deliberately NOT a progress tracker: the
                      generate endpoint is one request/response, so the app
                      cannot honestly say which of these is running. */}
                  <ol className="mt-3 space-y-2.5">
                    {PIPELINE.map(([title, detail], i) => (
                      <li key={title} className="flex gap-3">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-edge text-[10px] text-fg-faint">
                          {i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-fg-secondary">{title}</span>
                          <span className="block text-[11px] leading-4 text-fg-faint">{detail}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}
          </div>
        </section>

        {/* RIGHT — screens and guidance */}
        <aside aria-label="Screens and guidance" className="min-w-0 space-y-4">
          <div className="rounded-xl border border-edge bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">Screens</p>
              <span className="text-[10px] text-fg-faint">{screens.length}</span>
            </div>
            {screens.length ? (
              <ul className="mt-3 space-y-1.5">
                {screens.map((name, i) => (
                  <li
                    key={name}
                    className="flex items-center gap-2 rounded-lg border border-edge bg-surface-subtle px-2.5 py-2 text-xs text-fg-secondary"
                  >
                    <span className="font-mono text-[10px] text-fg-faint">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate">{name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs leading-5 text-fg-faint">
                Pick your core screens on the left and they will be listed here.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-edge bg-surface p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
              Getting a better result
            </p>
            <ul className="mt-3 space-y-2 text-[11px] leading-4 text-fg-muted">
              <li>Name the audience and the job the product does, not just the category.</li>
              <li>List the screens you actually need — every one is generated.</li>
              <li>A brand hex gives a more coherent palette than a preset.</li>
              <li>You can regenerate any single screen afterwards for far fewer credits.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
