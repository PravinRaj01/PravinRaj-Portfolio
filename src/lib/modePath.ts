// Shared helpers for building mode-aware URLs. Per SEO_GEO_PLAN.md §3:
// the URL is the source of truth for mode. `/` always belongs to whichever
// mode is `default_mode`; the other mode's pages (including its home) live
// under its own prefix. Every other page is always prefixed, regardless of
// which mode is default.

export type Mode = 'professional' | 'creative';

const PREFIX: Record<Mode, string> = {
  professional: '/pro',
  creative: '/creative',
};

export const SITE_URL = 'https://pravinraj.dev';

/** Home path for a mode: '/' for the default mode, '/<prefix>' otherwise. */
export function getModeHomePath(mode: Mode, defaultMode: Mode): string {
  return mode === defaultMode ? '/' : PREFIX[mode];
}

/**
 * Path for a page in a given mode. `suffix` is mode-relative and must start
 * with '/' (e.g. '/projects', `/experience/${id}`), or be '/' for the home
 * page itself.
 */
export function getModePath(mode: Mode, defaultMode: Mode, suffix: string): string {
  if (suffix === '/' || suffix === '') return getModeHomePath(mode, defaultMode);
  return `${PREFIX[mode]}${suffix}`;
}

/** Full canonical URL (https://pravinraj.dev/...) for a page. */
export function buildCanonical(mode: Mode, defaultMode: Mode, suffix: string): string {
  const path = getModePath(mode, defaultMode, suffix);
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

/**
 * Strips a leading `/pro` or `/creative` prefix off a pathname.
 * `rest` always starts with '/' ('/' itself for an exact prefix match).
 * `mode` is null when the pathname carries no mode prefix at all.
 */
export function stripModePrefix(pathname: string): { mode: Mode | null; rest: string } {
  for (const mode of ['professional', 'creative'] as Mode[]) {
    const prefix = PREFIX[mode];
    if (pathname === prefix) return { mode, rest: '/' };
    if (pathname.startsWith(`${prefix}/`)) return { mode, rest: pathname.slice(prefix.length) };
  }
  return { mode: null, rest: pathname };
}
