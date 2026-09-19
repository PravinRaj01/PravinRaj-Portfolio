import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { notFoundMeta } from '@/lib/seo';

const NotFound = () => {
  const location = useLocation();
  const { darkMode } = usePortfolio();

  // NotFound previously set no meta at all, so it silently inherited
  // whatever the last page left behind — this also gives every 404 a
  // consistent noindex, closing the "soft 404" gap (SEO_GEO_PLAN.md §5).
  usePageMeta(notFoundMeta());

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <CursorFollower />
      <RadialGradient 
        scale="scale-y-100" 
        opacity={darkMode ? "opacity-30" : "opacity-30"} 
      />
      <div className="text-center relative z-10">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-4">Oops! Page not found</p>
        <a href="/" className="text-primary hover:text-primary/80 underline">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
