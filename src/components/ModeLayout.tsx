import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { Mode, stripModePrefix } from '@/lib/modePath';

interface ModeLayoutProps {
  mode: Mode;
}

/**
 * Layout route for /pro/* and /creative/*. Replaces the old ModeRouteHandler,
 * which used to strip the prefix and hard-reload to the bare path — now the
 * prefix IS the canonical URL, so this just syncs the URL's mode into
 * PortfolioContext and renders the matched child in place (no reload).
 *
 * The one exception: the default mode's *bare* prefix (e.g. '/pro' on its own,
 * when professional is default) isn't canonical — that mode's home is '/'
 * (SEO_GEO_PLAN.md §3) — so only that exact URL redirects there. Child pages
 * like '/pro/projects' are canonical and always render normally.
 */
const ModeLayout = ({ mode }: ModeLayoutProps) => {
  const { defaultMode, modeSettingsLoaded, syncModeFromUrl } = usePortfolio();
  const location = useLocation();

  const isPrefixRoot = stripModePrefix(location.pathname).rest === '/';
  const redirectToRoot = mode === defaultMode && isPrefixRoot;

  useEffect(() => {
    if (!modeSettingsLoaded || redirectToRoot) return;
    syncModeFromUrl(mode);
  }, [mode, modeSettingsLoaded, redirectToRoot, syncModeFromUrl]);

  // Wait for settings before deciding anything — otherwise a fresh load of a
  // prefixed URL could redirect before defaultMode resolves.
  if (!modeSettingsLoaded) return null;

  if (redirectToRoot) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ModeLayout;
