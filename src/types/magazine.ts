export interface MagazineArticle {
  project_id: string;
  headline: string;
  pull_quote: string;
  body: string;
  layout: 'split_left' | 'split_right' | 'full_bleed';
  image_drive_id?: string;
}

export interface MagazineContent {
  title: string;
  cover: {
    headline: string;
    subhead: string;
    cover_image_drive_id?: string;
  };
  editors_note: {
    title: string;
    body: string;
  };
  articles: MagazineArticle[];
  closing: {
    title: string;
    body: string;
  };
}

export interface MagazineIssue {
  id: string;
  title: string;
  is_published: boolean;
  mode: string;
  cover_headline: string | null;
  cover_subhead: string | null;
  content: MagazineContent;
  project_ids: string[];
  created_at: string;
  updated_at: string;
}
