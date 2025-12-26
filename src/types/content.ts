
export interface SiteSettings {
  id: string;
  site_name: string;
  logo_url?: string;
  resume_url?: string;
  professional_mode_enabled?: boolean;
  creative_mode_enabled?: boolean;
  default_mode?: 'professional' | 'creative';
  mode_toggle_pages?: string[];
  professional_visible_pages?: string[];
  creative_visible_pages?: string[];
  professional_site_name?: string;
  professional_logo_url?: string;
  creative_site_name?: string;
  creative_logo_url?: string;
  chatbot_enabled?: boolean;
  chatbot_welcome_message?: string;
  chatbot_name?: string;
  chatbot_default_state?: 'mini' | 'sidebar' | 'full';
  created_at: string;
  updated_at: string;
}

export interface HeroContent {
  id: string;
  mode: 'professional' | 'creative';
  greeting: string;
  name: string;
  title: string;
  description: string;
  cta_text: string;
  cta_link?: string;
  order_index: number;
  animated_titles?: string[];
  profile_photo_url?: string;
  background_image_url?: string;
  animation_speed?: number;
  animation_pause_duration?: number;
  gradient_overlay_opacity?: number;
  created_at: string;
  updated_at: string;
}

export interface AboutContent {
  id: string;
  mode: 'professional' | 'creative';
  content: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  category: string;
  icon: string;
  skills: string[];
  color: string;
  mode: 'professional' | 'creative';
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Stat {
  id: string;
  label: string;
  value: string;
  mode: 'professional' | 'creative';
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  features: string[];
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface ContactContent {
  id: string;
  mode: 'professional' | 'creative';
  email: string;
  phone?: string;
  location?: string;
  title: string;
  subtitle?: string;
  services: string[];
  created_at: string;
  updated_at: string;
}
