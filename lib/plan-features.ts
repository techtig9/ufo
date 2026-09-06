import { PLAN_MONTHLY_CREDITS, PLAN_PRICE_USD, fullProjectsPerMonth } from './credits';
import { PLAN_STORAGE_BYTES, formatBytes } from './assets';
import type { Plan } from './types';

/**
 * Storage is quoted from PLAN_STORAGE_BYTES rather than typed as a string, so
 * the pricing page cannot advertise a limit the quota check does not enforce.
 */
const storage = (plan: Plan) => `${formatBytes(PLAN_STORAGE_BYTES[plan])} asset storage`;

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
      storage('free'),
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
      storage('starter'),
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
      'Figma export — not available yet',
      'CSV / JSON export',
      storage('pro'),
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
      storage('business'),
      'Workspaces, roles & team invitations',
      'API access — not available yet',
      '24/7 priority support',
    ],
  },
];
