import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ONBOARDING_KEY = 'gg_portfolio_onboarding_seen';
const MODE_FROM_URL_KEY = 'gg_portfolio_mode_from_url';

interface ModeRouteHandlerProps {
  targetMode: 'professional' | 'creative';
}

const ModeRouteHandler = ({ targetMode }: ModeRouteHandlerProps) => {
  const location = useLocation();

  useEffect(() => {
    // Clear any existing mode to prevent conflicts
    localStorage.removeItem('portfolioMode');
    
    // Set the new mode in localStorage
    localStorage.setItem('portfolioMode', targetMode);
    
    // Mark onboarding as seen to prevent popup
    localStorage.setItem(ONBOARDING_KEY, 'true');
    
    // Set session flag so PortfolioContext knows this was a URL-triggered mode
    sessionStorage.setItem(MODE_FROM_URL_KEY, targetMode);
    
    // Extract the subpath after /creative or /pro
    const pathname = location.pathname;
    const prefix = targetMode === 'creative' ? '/creative' : '/pro';
    const remainingPath = pathname.startsWith(prefix) 
      ? pathname.slice(prefix.length) || '/'
      : '/';
    
    // Preserve query string
    const search = location.search || '';
    
    // Force page reload to ensure clean state with new mode
    window.location.href = remainingPath + search;
  }, [targetMode, location.pathname, location.search]);

  // Return null since this component just handles the redirect
  return null;
};

export default ModeRouteHandler;
