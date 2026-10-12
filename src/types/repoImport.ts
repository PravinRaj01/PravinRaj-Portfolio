// Response of POST /ai/project-from-repo (backend/app/schemas/ai.py).
import type { ProjectLink } from '@/types/cms';

export interface RepoProjectDraft {
  title: string;
  description: string;
  category: string;
  categories: string[];
  tags: string[];
  position: string | null;
  positions: string[];
  project_date: string | null;
  github_url: string;
  live_url: string | null;
  project_links: ProjectLink[];
}

export interface RepoInfo {
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  languages: string | null;
  stars: number;
  forks: number;
  created_at: string | null;
  pushed_at: string | null;
  license: string | null;
  topics: string[];
  archived: boolean;
  is_fork: boolean;
  readme_found: boolean;
  files_considered: number;
  manifests: string[];
  tree_truncated: boolean;
}

export interface RepoImportResponse {
  draft: RepoProjectDraft;
  /** The facts the draft rests on, for the reviewer to check. */
  highlights: string[];
  repo: RepoInfo;
}
