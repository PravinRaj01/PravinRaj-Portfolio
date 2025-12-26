import { useState, useEffect } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PortfolioProvider, usePortfolio } from "./contexts/PortfolioContext";
import ErrorBoundary from "./components/ErrorBoundary";
import SplashScreen from "./components/SplashScreen";
import PortfolioChatbot from "./components/chatbot/PortfolioChatbot";
import OnboardingPopup from "./components/OnboardingPopup";
import ModeTransitionOverlay from "./components/ModeTransitionOverlay";
import Index from "./pages/Index";
import Academic from "./pages/Academic";
import Experience from "./pages/Experience";
import Projects from "./pages/Projects";
import Contact from "./pages/Contact";
import Podcast from "./pages/Podcast";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

console.log('App.tsx: Starting app initialization...');

const queryClient = new QueryClient();

console.log('App.tsx: QueryClient created successfully');

// Inner component that can use PortfolioContext
const AppContent = ({ load }: { load: boolean }) => {
  const { isTransitioning, transitionTargetMode } = usePortfolio();

  return (
    <>
      <ModeTransitionOverlay isTransitioning={isTransitioning} targetMode={transitionTargetMode} />
      <SplashScreen load={load} />
      <div id={load ? "no-scroll" : "scroll"}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/academic" element={<Academic />} />
            <Route path="/experience" element={<Experience />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/podcast" element={<Podcast />} />
            <Route path="/admin" element={<Admin />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <PortfolioChatbot />
        <OnboardingPopup />
      </div>
    </>
  );
};

const App = () => {
  console.log('App.tsx: App component rendering...');
  
  const [load, updateLoad] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateLoad(false);
    }, 1200);

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

console.log('App.tsx: App component defined successfully');

export default App;
