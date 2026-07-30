export type Plan = 'free' | 'starter' | 'pro' | 'business';

export type ProjectType = 'web' | 'mobile' | 'dashboard' | 'landing' | 'ecommerce';

export interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    display: string;
    body: string;
  };
  spacing: {
    scale: number[]; // e.g. [4, 8, 12, 16, 24, 32, 48, 64]
  };
}

export interface GeneratedScreen {
  name: string;
  orderIndex: number;
  code: string; // full static HTML + Tailwind classes
  hotspots: Hotspot[]; // interactive elements tagged for the prototype viewer
}

export interface Hotspot {
  selector: string; // CSS selector or data-hotspot-id within the screen's code
  label: string;
  linksToScreenName: string | null; // null = no link wired yet
}

export interface GeneratedProject {
  tokens: DesignTokens;
  screens: GeneratedScreen[];
}

export interface FollowUpAnswers {
  projectType: ProjectType;
  targetDevices: ('desktop' | 'mobile' | 'tablet' | 'responsive')[];
  designStyle: 'minimal' | 'modern' | 'playful' | 'corporate' | 'bold';
  coreScreens: string[]; // e.g. ['Home', 'Login/Signup', 'Checkout']
  navigationPattern: 'top-nav' | 'sidebar' | 'bottom-tabs' | 'hamburger';
  colorTheme: { preset?: string; brandHex?: string };
  fontPairing: string; // id of a curated pairing
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  project_type: ProjectType;
  design_style: string | null;
  color_theme: DesignTokens['colors'] | null;
  font_pairing: string | null;
  figma_export_status: 'queued' | 'exported' | null;
  is_favorite?: boolean;
  tags?: string[];
  created_at: string;
}

export interface Screen {
  id: string;
  project_id: string;
  name: string;
  order_index: number;
  code: string;
  thumbnail: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: Plan;
  status: string;
  provider: string;
  paddle_subscription_id: string | null;
  paddle_customer_id: string | null;
  credits_remaining: number;
  renews_at: string | null;
}
