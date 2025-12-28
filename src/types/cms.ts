
export interface Project {
  id: string;
  title: string;
  description: string;
  image_drive_id?: string;
  tags: string[];
  category: string;
  github_url?: string;
  live_url?: string;
  featured: boolean;
  mode: 'professional' | 'creative';
  order_index: number;
  project_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  location: string;
  period: string;
  description: string;
  achievements: string[];
  mode: 'professional' | 'creative';
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Social {
  id: string;
  name: string;
  icon: string;
  url: string;
  enabled: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}
