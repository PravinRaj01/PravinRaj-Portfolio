// Pure logic for the chat assistant's page navigation (AI v2, Phase 3).
//
// The backend validates the model's tool call and sends a small `action` event
// (backend/app/services/chat_stream.py). The browser still treats that event as
// untrusted input: it is re-validated here, and the final URL is built from a
// fixed set of routes -- the event can never supply a raw path or URL.
import { getModeHomePath, getModePath, type Mode } from '@/lib/modePath';
import type { AssistantPage, NavigateAction } from '@/types/chat';

export const ASSISTANT_PAGES: readonly AssistantPage[] = [
  'home',
  'projects',
  'experience',
  'academic',
  'contact',
  'podcast',
];

const MODES: readonly Mode[] = ['professional', 'creative'];
const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/;
const MAX_SEARCH = 60;
const MAX_ANNOUNCEMENT = 160;

/**
 * Router location state attached to assistant-driven navigations. The Projects
 * page uses it to apply the requested filters even when it is already mounted.
 */
export const ASSISTANT_NAV_STATE = { assistant: true } as const;

export const PAGE_LABELS: Record<AssistantPage, string> = {
  home: 'Home',
  projects: 'Projects',
  experience: 'Experience',
  academic: 'Academic',
  contact: 'Contact',
  podcast: 'Podcast',
};

// Control characters (newlines, tabs, NUL...) become spaces.
const stripControl = (value: string): string =>
  Array.from(value, (ch) => {
    const code = ch.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : ch;
  }).join('');

const asText = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const text = stripControl(value).replace(/\s+/g, ' ').trim().slice(0, max);
  return text || null;
};

/** Validates one decoded `action` stream event. Null means "ignore it". */
export function parseNavigateAction(raw: unknown): NavigateAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const event = raw as Record<string, unknown>;
  if (event.type !== 'action' || event.action !== 'navigate') return null;

  const page = event.page;
  if (typeof page !== 'string' || !(ASSISTANT_PAGES as readonly string[]).includes(page)) return null;

  const mode = event.mode;
  const slug = typeof event.slug === 'string' && SLUG.test(event.slug) ? event.slug : null;

  return {
    page: page as AssistantPage,
    mode: typeof mode === 'string' && (MODES as readonly string[]).includes(mode) ? (mode as Mode) : null,
    search: page === 'projects' ? asText(event.search, MAX_SEARCH) : null,
    slug: page === 'projects' || page === 'experience' ? slug : null,
    announcement: asText(event.announcement, MAX_ANNOUNCEMENT) ?? `Taking you to the ${PAGE_LABELS[page as AssistantPage]} page.`,
  };
}

export interface NavigationContext {
  mode: Mode;
  defaultMode: Mode;
  professionalModeEnabled: boolean;
  creativeModeEnabled: boolean;
  professionalVisiblePages: string[];
  creativeVisiblePages: string[];
}

export interface NavigationTarget {
  path: string;
}

/**
 * Where an action should take the visitor, or null if that page isn't
 * available anywhere. Mode choice mirrors LegacyModeRedirect: the mode the
 * visitor asked for (if any), then the one they're in, then the default, then
 * professional, then creative -- skipping modes that are switched off or hide
 * the page.
 */
export function resolveNavigation(action: NavigateAction, ctx: NavigationContext): NavigationTarget | null {
  const enabled = (m: Mode) => (m === 'professional' ? ctx.professionalModeEnabled : ctx.creativeModeEnabled);
  const shows = (m: Mode) =>
    action.page === 'home' ||
    (m === 'professional' ? ctx.professionalVisiblePages : ctx.creativeVisiblePages).includes(action.page);

  const candidates: Mode[] = [];
  for (const m of [action.mode, ctx.mode, ctx.defaultMode, 'professional', 'creative'] as (Mode | null)[]) {
    if (m && !candidates.includes(m)) candidates.push(m);
  }
  const target = candidates.find((m) => enabled(m) && shows(m));
  if (!target) return null;

  if (action.page === 'home') return { path: getModeHomePath(target, ctx.defaultMode) };

  // A single project or job: the owning mode isn't known here (the visitor may
  // be in the other mode), so unless a mode was asked for, use the unprefixed
  // detail URL -- the legacy redirect routes already look up which mode owns
  // the slug and send the visitor there.
  if (action.slug && (action.page === 'projects' || action.page === 'experience')) {
    const detail = `/${action.page}/${encodeURIComponent(action.slug)}`;
    return { path: action.mode ? getModePath(target, ctx.defaultMode, detail) : detail };
  }

  const suffix =
    action.page === 'projects' && action.search
      ? `/projects?search=${encodeURIComponent(action.search)}`
      : `/${action.page}`;
  return { path: getModePath(target, ctx.defaultMode, suffix) };
}

/** Short text for the "open again" chip under an assistant reply. */
export function describeAction(action: NavigateAction): string {
  const page = PAGE_LABELS[action.page];
  if (action.slug) return `Open ${page === 'Projects' ? 'project' : 'experience'}: ${action.slug.replace(/[-_]+/g, ' ')}`;
  if (action.search) return `Open ${page} · ${action.search}`;
  return `Open ${page}`;
}

/**
 * If `raw` points at this site, its in-app path (pathname + search + hash);
 * otherwise null. Used so links the assistant writes navigate inside the SPA
 * instead of opening a new tab.
 */
export function toInternalPath(
  raw: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
  siteOrigin = 'https://pravinraj.dev'
): string | null {
  try {
    const url = new URL(raw.trim(), origin);
    if (url.origin !== origin && url.origin !== siteOrigin) return null;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
