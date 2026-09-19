import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { Mode } from '@/lib/modePath';

interface ModeLayoutProps {
  mode: Mode;
}

/**
 * Layout route for /pro/* and /creative/*. Replaces the old ModeRouteHandler,
 * which used to strip the prefix and hard-reload to the bare path — now the
 * prefix IS the canonical URL, so this just syncs the URL's mode into
 * PortfolioContext and renders the matched child in place (no reload).
 *
 * The one exception: the default mode's own prefix isn't canonical — that
 * mode's home is '/' (SEO_GEO_PLAN.md §3) — so this redirects there instead.
 */
const ModeLayout = ({ mode }: ModeLayoutProps) => {
  const { defaultMode, modeSettingsLoaded, syncModeFromUrl } = usePortfolio();

  useEffect(() => {
    if (!modeSettingsLoaded || mode === defaultMode) return;
    syncModeFromUrl(mode);
  }, [mode, defaultMode, modeSettingsLoaded, syncModeFromUrl]);

  // Wait for settings before deciding anything — otherwise a fresh load of
  // the non-default mode's prefix could flash a redirect to '/' before
  // defaultMode resolves.
  if (!modeSettingsLoaded) return null;

  if (mode === defaultMode) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ModeLayout;
