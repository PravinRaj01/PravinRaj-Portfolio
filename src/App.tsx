import { useState, useEffect, lazy, Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PortfolioProvider, usePortfolio } from "./contexts/PortfolioContext";
import ErrorBoundary from "./components/ErrorBoundary";
import SplashScreen from "./components/SplashScreen";
import ModeTransitionOverlay from "./components/ModeTransitionOverlay";
import ModeLayout from "./components/ModeLayout";
import VisiblePageGuard from "./components/VisiblePageGuard";
import {
  LegacyModeRedirect,
  LegacyProjectRedirect,
  LegacyProjectFolderRedirect,
  LegacyExperienceRedirect,
} from "./components/LegacyRedirects";
import Index from "./pages/Index";

// Lazy-load every non-home route — these only download when visited.
const Academic = lazy(() => import("./pages/Academic"));
const Experience = lazy(() => import("./pages/Experience"));
const ExperienceDetail = lazy(() => import("./pages/ExperienceDetail"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const ProjectFolder = lazy(() => import("./pages/ProjectFolder"));
const Contact = lazy(() => import("./pages/Contact"));
const Podcast = lazy(() => import("./pages/Podcast"));
const Playground = lazy(() => import("./pages/Playground"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy-load non-critical UI that lives outside the route tree
const PortfolioChatbot = lazy(() => import("./components/chatbot/PortfolioChatbot"));
const OnboardingPopup = lazy(() => import("./components/OnboardingPopup"));
const KonamiCodeListener = lazy(() => import("./components/games/KonamiCodeListener"));

const queryClient = new QueryClient();

// Inner component that can use PortfolioContext
const AppContent = ({ load }: { load: boolean }) => {
  const { isTransitioning, transitionTargetMode } = usePortfolio();

  // Every mode-scoped page, shared by both the /pro and /creative subtrees —
  // built once so the two trees can't drift apart. `Index` doubles as each
  // mode's home (it already renders per `mode` from context); which literal
  // URL it's mounted at ('/' vs '/pro' vs '/creative') is decided by
  // ModeLayout, not by this component.
  //
  // Every non-home page is wrapped in VisiblePageGuard, not just
  // academic/podcast — visibility is fully admin-configurable per mode
  // (ModeSettingsManager), so any of these can be hidden. This also keeps
  // the live app consistent with scripts/prerender.ts (Phase 2), which
  // likewise only generates a static page when it's visible for that mode.
  const modeChildRoutes = (
    <>
      <Route index element={<Index />} />
      <Route
        path="projects"
        element={
          <VisiblePageGuard pageId="projects" fallback={<NotFound />}>
            <Projects />
          </VisiblePageGuard>
        }
      />
      <Route
        path="projects/folder/:folderId"
        element={
          <VisiblePageGuard pageId="projects" fallback={<NotFound />}>
            <ProjectFolder />
          </VisiblePageGuard>
        }
      />
      <Route
        path="projects/:id"
        element={
          <VisiblePageGuard pageId="projects" fallback={<NotFound />}>
            <ProjectDetail />
          </VisiblePageGuard>
        }
      />
      <Route
        path="experience"
        element={
          <VisiblePageGuard pageId="experience" fallback={<NotFound />}>
            <Experience />
          </VisiblePageGuard>
        }
      />
      <Route
        path="experience/:id"
        element={
          <VisiblePageGuard pageId="experience" fallback={<NotFound />}>
            <ExperienceDetail />
          </VisiblePageGuard>
        }
      />
      <Route
        path="academic"
        element={
          <VisiblePageGuard pageId="academic" fallback={<NotFound />}>
            <Academic />
          </VisiblePageGuard>
        }
      />
      <Route
        path="contact"
        element={
          <VisiblePageGuard pageId="contact" fallback={<NotFound />}>
            <Contact />
          </VisiblePageGuard>
        }
      />
      <Route
        path="podcast"
        element={
          <VisiblePageGuard pageId="podcast" fallback={<NotFound />}>
            <Podcast />
          </VisiblePageGuard>
        }
      />
    </>
  );

  return (
    <>
      <SpeedInsights />
      <ModeTransitionOverlay isTransitioning={isTransitioning} targetMode={transitionTargetMode} />
      <SplashScreen load={load} />
      <div id={load ? "no-scroll" : "scroll"}>
        <Toaster />
        <Sonner />
        <Suspense fallback={null}>
          <KonamiCodeListener />
        </Suspense>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Index />} />

            <Route path="/pro" element={<ModeLayout mode="professional" />}>
              {modeChildRoutes}
            </Route>
            <Route path="/creative" element={<ModeLayout mode="creative" />}>
              {modeChildRoutes}
            </Route>

            <Route path="/playground" element={<Playground />} />
            <Route path="/admin" element={<Admin />} />

            {/* Legacy unprefixed URLs — client-side redirect to wherever the
                page is actually visible (or, for detail pages, whichever mode
                owns that item), rendering NotFound instead of a guaranteed
                404 if it's hidden everywhere. The four list-page routes below
                (projects/experience/academic/contact) now get a real HTTP 301
                from vercel.json instead — they stay here only as a fallback
                for anything that reaches the SPA before that redirect (see
                SEO_GEO_PLAN.md Phase 2 §4). podcast has no static redirect
                (not currently visible in either mode) so it still resolves
                here. */}
            <Route path="/projects" element={<LegacyModeRedirect suffix="/projects" pageId="projects" notFound={<NotFound />} />} />
            <Route path="/projects/folder/:folderId" element={<LegacyProjectFolderRedirect notFound={<NotFound />} />} />
            <Route path="/projects/:id" element={<LegacyProjectRedirect notFound={<NotFound />} />} />
            <Route path="/experience" element={<LegacyModeRedirect suffix="/experience" pageId="experience" notFound={<NotFound />} />} />
            <Route path="/experience/:id" element={<LegacyExperienceRedirect notFound={<NotFound />} />} />
            <Route path="/academic" element={<LegacyModeRedirect suffix="/academic" pageId="academic" notFound={<NotFound />} />} />
            <Route path="/contact" element={<LegacyModeRedirect suffix="/contact" pageId="contact" notFound={<NotFound />} />} />
            <Route path="/podcast" element={<LegacyModeRedirect suffix="/podcast" pageId="podcast" notFound={<NotFound />} />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Suspense fallback={null}>
          <PortfolioChatbot />
        </Suspense>
        <Suspense fallback={null}>
          <OnboardingPopup />
        </Suspense>
      </div>
    </>
  );
};

const App = () => {
  const [load, updateLoad] = useState(true);

  useEffect(() => {
    // Hide splash quickly — React has already mounted by the time this fires.
    const timer = setTimeout(() => {
      updateLoad(false);
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {/* BrowserRouter wraps PortfolioProvider (not the reverse, as it used
              to be) so PortfolioContext can use useLocation()/useNavigate()
              instead of reading window.location.* directly — needed to make
              mode reactive to the URL and to use real SPA navigation for the
              mode toggle instead of a hard reload. */}
          <BrowserRouter>
            <PortfolioProvider>
              <AppContent load={load} />
            </PortfolioProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
