import { z } from 'zod';

const followUpAnswersSchema = z.object({
  projectType: z.enum(['web', 'mobile', 'dashboard', 'landing', 'ecommerce']),
  targetDevices: z.array(z.enum(['desktop', 'mobile', 'tablet', 'responsive'])).min(1),
  designStyle: z.enum(['minimal', 'modern', 'playful', 'corporate', 'bold']),
  coreScreens: z.array(z.string().trim().min(1)).min(1).max(20),
  navigationPattern: z.enum(['top-nav', 'sidebar', 'bottom-tabs', 'hamburger']),
  colorTheme: z.object({
    preset: z.string().optional(),
    brandHex: z.string().optional(),
  }),
  fontPairing: z.string().min(1),
});

export const generateRequestSchema = z.object({
  mode: z.enum(['scratch', 'import']),
  projectName: z.string().trim().min(1).max(120),
  description: z.string().max(4000).optional(),
  importSource: z.string().max(500).optional(),
  importInstruction: z.string().max(2000).optional(),
  answers: followUpAnswersSchema,
});

export const contactFormSchema = z.object({
  email: z.string().email(),
  message: z.string().trim().min(1).max(5000),
});

export const commentSchema = z.object({
  shareId: z.string().uuid(),
  screenId: z.string().uuid(),
  authorName: z.string().trim().min(1).max(60).default('Guest'),
  body: z.string().trim().min(1).max(2000),
});
