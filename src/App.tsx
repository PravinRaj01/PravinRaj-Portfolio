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
import ModeRouteHandler from "./components/ModeRouteHandler";
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

  return (
    <>
      <SpeedInsights />
      <ModeTransitionOverlay isTransitioning={isTransitioning} targetMode={transitionTargetMode} />
      <SplashScreen load={load} />
      <div id={load ? "no-scroll" : "scroll"}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={null}>
            <KonamiCodeListener />
          </Suspense>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/creative" element={<ModeRouteHandler targetMode="creative" />} />
              <Route path="/creative/*" element={<ModeRouteHandler targetMode="creative" />} />
              <Route path="/pro" element={<ModeRouteHandler targetMode="professional" />} />
              <Route path="/pro/*" element={<ModeRouteHandler targetMode="professional" />} />
              <Route path="/academic" element={<Academic />} />
              <Route path="/experience" element={<Experience />} />
              <Route path="/experience/:id" element={<ExperienceDetail />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/folder/:folderId" element={<ProjectFolder />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/podcast" element={<Podcast />} />
              <Route path="/playground" element={<Playground />} />
              <Route path="/admin" element={<Admin />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
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
          <PortfolioProvider>
            <AppContent load={load} />
          </PortfolioProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
