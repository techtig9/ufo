import { PLAN_MONTHLY_CREDITS, PLAN_PRICE_USD, fullProjectsPerMonth } from './credits';
import type { Plan } from './types';

export interface PlanCard {
  plan: Plan;
  label: string;
  tagline: string;
  price: number;
  credits: number;
  fullProjects: number;
  featured?: boolean;
  features: string[];
}

export const PLAN_CARDS: PlanCard[] = [
  {
    plan: 'free',
    label: 'Free',
    tagline: 'Try the generator, no card required',
    price: PLAN_PRICE_USD.free,
    credits: PLAN_MONTHLY_CREDITS.free,
    fullProjects: fullProjectsPerMonth('free'),
    features: [
      'Web preview only, no export',
      'Project folders, tags & favorites',
      'View-only shareable link',
      'Community support',
    ],
  },
  {
    plan: 'starter',
    label: 'Starter',
    tagline: 'For a solo project you actually ship',
    price: PLAN_PRICE_USD.starter,
    credits: PLAN_MONTHLY_CREDITS.starter,
    fullProjects: fullProjectsPerMonth('starter'),
    features: [
      'All project types',
      'Voice input',
      'Import & redesign an existing design',
      'Code export + Design Handoff spec sheet',
      'Shareable link with QR code + comments',
      'Email support',
    ],
  },
  {
    plan: 'pro',
    label: 'Pro',
    tagline: 'For a working design practice',
    price: PLAN_PRICE_USD.pro,
    credits: PLAN_MONTHLY_CREDITS.pro,
    fullProjects: fullProjectsPerMonth('pro'),
    featured: true,
    features: [
      'Everything in Starter',
      'Priority generation queue',
      'Export to Figma (queued — full API in Phase 2)',
      'CSV / JSON export',
      '10 GB cloud storage',
      'Priority support',
    ],
  },
  {
    plan: 'business',
    label: 'Business',
    tagline: 'For teams shipping client work',
    price: PLAN_PRICE_USD.business,
    credits: PLAN_MONTHLY_CREDITS.business,
    fullProjects: fullProjectsPerMonth('business'),
    features: [
      'Everything in Pro',
      'Highest-priority queue',
      '50 GB cloud storage',
      'Team members (Phase 2)',
      'API access (Phase 2)',
      '24/7 priority support',
    ],
  },
];
