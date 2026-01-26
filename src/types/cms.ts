
export interface CropPosition {
  x: number;
  y: number;
  zoom?: number;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  image_drive_id?: string;
  image_home_drive_id?: string;
  image_scroll_enabled?: boolean;
  crop_landscape?: CropPosition;
  crop_square?: CropPosition;
  crop_phone?: CropPosition;
  crop_tablet?: CropPosition;
  gallery_images?: string[];
  video_url?: string;
  video_thumbnail_drive_id?: string;
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
  include_thumbnail_in_gallery?: boolean;
  position?: string;
  positions?: string[];
  categories?: string[];
  folder_id?: string | null;
  folder_name?: string;
  show_in_recent?: boolean;
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
  // New fields for flexible date handling
  experience_type?: 'job' | 'event';
  date_type?: 'single' | 'range';
  event_date?: string;
  role?: string;
  event_images?: string[];
  // Certificate fields
  certificate_url?: string;
  certificate_drive_id?: string;
}

export interface Social {
  id: string;
  name: string;
  icon: string;
  url: string;
  enabled: boolean;
  order_index: number;
  mode: 'professional' | 'creative';
  created_at: string;
  updated_at: string;
}
