'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { UpgradeModal } from '@/components/dashboard/upgrade-modal';
import type { FollowUpAnswers, ProjectType } from '@/lib/types';

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'web', label: 'Website' },
  { value: 'mobile', label: 'Mobile App' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'landing', label: 'Landing Page' },
  { value: 'ecommerce', label: 'E-commerce' },
];

const DEVICES: FollowUpAnswers['targetDevices'][number][] = ['desktop', 'mobile', 'tablet', 'responsive'];
const STYLES: FollowUpAnswers['designStyle'][] = ['minimal', 'modern', 'playful', 'corporate', 'bold'];
const NAV_PATTERNS: { value: FollowUpAnswers['navigationPattern']; label: string }[] = [
  { value: 'top-nav', label: 'Top nav' },
  { value: 'sidebar', label: 'Sidebar' },
  { value: 'bottom-tabs', label: 'Bottom tab bar' },
  { value: 'hamburger', label: 'Hamburger menu' },
];
const CORE_SCREEN_OPTIONS = [
  'Home', 'Login/Signup', 'Onboarding', 'Profile', 'Settings', 'Checkout', 'Detail page',
];
const FONT_PAIRINGS = ['Inter + Source Serif', 'Poppins + Inter', 'Space Grotesk + Inter', 'Manrope + Lora'];
const COLOR_PRESETS = ['Violet & Teal', 'Warm Sunset', 'Ocean Blue', 'Monochrome'];

type Step = 'describe' | 'device' | 'style' | 'screens' | 'nav' | 'color' | 'font' | 'review';
const STEP_ORDER: Step[] = ['describe', 'device', 'style', 'screens', 'nav', 'color', 'font', 'review'];

export function GeneratorForm({ canImport }: { canImport: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('describe');
  const [mode, setMode] = useState<'scratch' | 'import'>('scratch');
  const [generating, setGenerating] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);

  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [importSource, setImportSource] = useState('');
  const [importInstruction, setImportInstruction] = useState('');

  const [answers, setAnswers] = useState<FollowUpAnswers>({
    projectType: 'web',
    targetDevices: ['responsive'],
    designStyle: 'modern',
    coreScreens: ['Home'],
    navigationPattern: 'top-nav',
    colorTheme: { preset: 'Violet & Teal' },
    fontPairing: 'Inter + Source Serif',
  });

  const stepIndex = STEP_ORDER.indexOf(step);

  function next() {
    const i = STEP_ORDER.indexOf(step);
    if (i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]);
  }
  function back() {
    const i = STEP_ORDER.indexOf(step);
    if (i > 0) setStep(STEP_ORDER[i - 1]);
  }

  function toggleScreen(s: string) {
    setAnswers((a) => ({
      ...a,
      coreScreens: a.coreScreens.includes(s)
        ? a.coreScreens.filter((x) => x !== s)
        : [...a.coreScreens, s],
    }));
  }
  function toggleDevice(d: FollowUpAnswers['targetDevices'][number]) {
    setAnswers((a) => ({
      ...a,
      targetDevices: a.targetDevices.includes(d)
        ? a.targetDevices.filter((x) => x !== d)
        : [...a.targetDevices, d],
    }));
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'scratch'
            ? { mode, projectName, description, answers }
            : { mode, projectName, importSource, importInstruction, answers }
        ),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          setUpgradeReason(data.error ?? 'You\u2019ve hit a plan limit.');
        } else {
          toast.error(data.error ?? 'Generation failed');
        }
        setGenerating(false);
        return;
      }

      toast.success('Design generated');
      router.push(`/dashboard/projects/${data.projectId}`);
    } catch {
      toast.error('Network error — please try again');
      setGenerating(false);
    }
  }

  if (generating) {
    return (
      <Panel className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-4 h-40 w-full max-w-md shimmer" />
        <p className="font-medium">Generating your screens{'\u2026'}</p>
        <p className="mt-1 text-sm text-white/50">
          Building a shared design system, then rendering each linked screen. Usually 15{'\u2013'}45s.
        </p>
      </Panel>
    );
  }

  return (
    <>
    <Panel className="mx-auto max-w-2xl" hover={false}>
      {/* progress */}
      <div className="mb-6 flex gap-1.5">
        {STEP_ORDER.map((s, i) => (
          <div
            key={s}
            className={clsx(
              'h-1 flex-1 rounded-full transition-colors',
              i <= stepIndex ? 'bg-studio-citron' : 'bg-white/10'
            )}
          />
        ))}
      </div>

      {step === 'describe' && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">What are you building?</h2>
          {canImport && (
            <div className="flex gap-2">
              <button
                onClick={() => setMode('scratch')}
                className={clsx('rounded-full px-4 py-1.5 text-sm', mode === 'scratch' ? 'bg-white/10' : 'text-white/50')}
              >
                Start from scratch
              </button>
              <button
                onClick={() => setMode('import')}
                className={clsx('rounded-full px-4 py-1.5 text-sm', mode === 'import' ? 'bg-white/10' : 'text-white/50')}
              >
                Import existing design
              </button>
            </div>
          )}
          <input
            placeholder="Project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
          />
          {mode === 'scratch' ? (
            <textarea
              placeholder="Describe what you're building and who it's for\u2026"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
            />
          ) : (
            <>
              <input
                placeholder="Live URL, or describe the screenshot/Figma link you'll attach"
                value={importSource}
                onChange={(e) => setImportSource(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
              />
              <textarea
                placeholder="What should change or extend?"
                value={importInstruction}
                onChange={(e) => setImportInstruction(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
              />
            </>
          )}
          <div>
            <p className="mb-2 text-sm text-white/60">Project type</p>
            <div className="flex flex-wrap gap-2">
              {PROJECT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setAnswers((a) => ({ ...a, projectType: t.value }))}
                  className={clsx(
                    'rounded-full border px-4 py-1.5 text-sm',
                    answers.projectType === t.value
                      ? 'border-studio-citron bg-studio-citron/20'
                      : 'border-white/10 text-white/60'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'device' && (
        <StepChoices
          title="Target device(s)"
          options={DEVICES.map((d) => ({ value: d, label: d }))}
          selected={answers.targetDevices}
          onToggle={(v) => toggleDevice(v as FollowUpAnswers['targetDevices'][number])}
          multi
        />
      )}

      {step === 'style' && (
        <StepChoices
          title="Design style"
          options={STYLES.map((s) => ({ value: s, label: s }))}
          selected={[answers.designStyle]}
          onToggle={(v) => setAnswers((a) => ({ ...a, designStyle: v as FollowUpAnswers['designStyle'] }))}
        />
      )}

      {step === 'screens' && (
        <StepChoices
          title="Core screens"
          options={CORE_SCREEN_OPTIONS.map((s) => ({ value: s, label: s }))}
          selected={answers.coreScreens}
          onToggle={toggleScreen}
          multi
        />
      )}

      {step === 'nav' && (
        <StepChoices
          title="Navigation pattern"
          options={NAV_PATTERNS}
          selected={[answers.navigationPattern]}
          onToggle={(v) => setAnswers((a) => ({ ...a, navigationPattern: v as FollowUpAnswers['navigationPattern'] }))}
        />
      )}

      {step === 'color' && (
        <StepChoices
          title="Color theme"
          options={COLOR_PRESETS.map((c) => ({ value: c, label: c }))}
          selected={[answers.colorTheme.preset ?? '']}
          onToggle={(v) => setAnswers((a) => ({ ...a, colorTheme: { preset: v } }))}
        />
      )}

      {step === 'font' && (
        <StepChoices
          title="Font pairing"
          options={FONT_PAIRINGS.map((f) => ({ value: f, label: f }))}
          selected={[answers.fontPairing]}
          onToggle={(v) => setAnswers((a) => ({ ...a, fontPairing: v }))}
        />
      )}

      {step === 'review' && (
        <div className="space-y-3 text-sm">
          <h2 className="text-lg font-medium">Ready to generate</h2>
          <p className="text-white/60">{projectName || 'Untitled project'}</p>
          <ul className="space-y-1 text-white/50">
            <li>Type: {answers.projectType}</li>
            <li>Devices: {answers.targetDevices.join(', ')}</li>
            <li>Style: {answers.designStyle}</li>
            <li>Screens: {answers.coreScreens.join(', ')}</li>
            <li>Nav: {answers.navigationPattern}</li>
          </ul>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={back} disabled={stepIndex === 0}>
          Back
        </Button>
        {step === 'review' ? (
          <Button onClick={handleGenerate} disabled={!projectName}>
            Generate
          </Button>
        ) : (
          <Button onClick={next} disabled={step === 'describe' && !projectName}>
            Next
          </Button>
        )}
      </div>
    </Panel>
    {upgradeReason && <UpgradeModal reason={upgradeReason} onClose={() => setUpgradeReason(null)} />}
    </>
  );
}

function StepChoices({
  title,
  options,
  selected,
  onToggle,
  multi,
}: {
  title: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  multi?: boolean;
}) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-medium capitalize">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onToggle(o.value)}
            className={clsx(
              'rounded-full border px-4 py-1.5 text-sm capitalize',
              selected.includes(o.value)
                ? 'border-studio-citron bg-studio-citron/20'
                : 'border-white/10 text-white/60'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {multi && <p className="mt-2 text-xs text-white/30">Select one or more.</p>}
    </div>
  );
}
