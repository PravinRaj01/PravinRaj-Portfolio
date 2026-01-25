import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ONBOARDING_KEY = 'gg_portfolio_onboarding_seen';
const MODE_FROM_URL_KEY = 'gg_portfolio_mode_from_url';

interface ModeRouteHandlerProps {
  targetMode: 'professional' | 'creative';
}

const ModeRouteHandler = ({ targetMode }: ModeRouteHandlerProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    // Set the mode in localStorage
    localStorage.setItem('portfolioMode', targetMode);
    
    // Mark onboarding as seen to prevent popup
    localStorage.setItem(ONBOARDING_KEY, 'true');
    
    // Set session flag so PortfolioContext knows this was a URL-triggered mode
    sessionStorage.setItem(MODE_FROM_URL_KEY, targetMode);
    
    // Redirect to home page
    navigate('/', { replace: true });
  }, [targetMode, navigate]);

  // Return null since this component just handles the redirect
  return null;
};

export default ModeRouteHandler;
