import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import ThreeBackground from '@/components/ThreeBackground';
import Hero from '@/components/Hero';
import Skills from '@/components/Skills';
import RecentProjects from '@/components/RecentProjects';
import SideFloatingButtons from '@/components/SideFloatingButtons';
import GithubTicker from '@/components/GithubTicker';
import Divider from '@/components/Divider';
import BannerQuote from '@/components/BannerQuote';
import RadialGradient from '@/components/RadialGradient';
import ScrollProgress from '@/components/ScrollProgress';
import Footer from '@/components/Footer';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useAboutContent } from '@/hooks/useAboutContent';


const Index = () => {
  const navigate = useNavigate();
  const { mode, darkMode } = usePortfolio();
  const { data: aboutContent = [] } = useAboutContent(mode);

  // Unified divider styling for the home page (color, thickness, glow)
  const homeDividerThicknessPx = 3;
  const homeDividerGlowPx = 1;
  const homeDividerColorName = mode === 'creative' ? 'creative-orange-light' : 'primary-light';
  const homeDividerHex = mode === 'creative' ? '#ff8c5a' : '#e9d5ff';
  const homeDividerFilter = `drop-shadow(0 0 ${homeDividerGlowPx}px ${homeDividerHex})`;

  // Get about content for BannerQuote, or use fallback
  const aboutQuote = aboutContent[0]?.content || 
    (mode === 'professional' 
      ? "It's not at all important to get it right the first time. It's vitally important to get it right the last time."
      : "Creativity is intelligence having fun. Every great design begins with an even better story.");
  
  // Get section title from content or use default
  const aboutSectionTitle = aboutContent[0]?.section_title || 'About Me';

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden relative" style={{ touchAction: 'pan-y pinch-zoom' }}>
      {/* Scroll Progress Bar */}
      <ScrollProgress position="left" height={4} smoothness={true} />
      
      {/* Three.js Background */}
      <ThreeBackground />
      
      {/* Main RadialGradient Background - extends across entire page */}
      <div className="fixed inset-0 z-0">
        <RadialGradient 
          scale="scale-y-[4]" 
          opacity="opacity-30" 
          position="top-0"
        />
      </div>
      
      {/* Custom Cursor */}
      <CursorFollower />
      
      {/* Navigation */}
      <Navigation />

      {/* Side Floating Buttons */}
      <SideFloatingButtons />

      {/* Header Section - Hero */}
      <header className="min-h-screen relative z-10 overflow-visible">
        <Hero mode={mode} />
      </header>

      {/* Main Content */}
      <main className="relative">
        {/* About Me Section - BannerQuote style like reference 1 */}
        <BannerQuote
          style="withBG"
          content={aboutQuote}
          sectionTitle={aboutSectionTitle}
        />
        
        {/* Divider */}
        <Divider
          thickness="0.15rem"
          direction="outer-right-to-inner-left"
          color={homeDividerColorName}
          height="small"
          dividerStyle="solid"
        />

        {/* TechStack & Skills Section */}
        <section className="relative z-10" id="skills">
          <Skills mode={mode} />
        </section>
        
        {/* Line path behind GitHub ticker - step pattern */}
        <div className="relative">
          {/* Top vertical line - above ribbon on left side */}
          <div 
            className="absolute z-0 left-1/4" //
            style={{
              borderLeft: `${homeDividerThicknessPx}px solid ${homeDividerHex}`,
              width: '0',
              // Start lower to create a clear empty gap above (matches reference)
              top: '-20px',
              // End exactly at the ribbon's top edge (64px)
              height: '60px',
              filter: homeDividerFilter,
            }}
          />
          
          {/* Horizontal line - runs behind the ribbon to center */}
          <div 
            className="absolute z-0"
            style={{
              borderTop: `${homeDividerThicknessPx}px solid ${homeDividerHex}`,
              height: '0',
              width: '25%',
              left: '25%',
              top: '40px',
              filter: homeDividerFilter,
            }}
          />
          
          {/* Bottom vertical line - from center, through and below ribbon */}
          <div 
            className="absolute z-0 left-1/2 -translate-x-1/2"
            style={{
              borderLeft: `${homeDividerThicknessPx}px solid ${homeDividerHex}`,
              width: '0',
              height: '200px',
              top: '40px',
              filter: homeDividerFilter,
            }}
          />

          {/* GithubTicker - sits on top of the line */}
          <div className="relative z-10 py-16">
            <GithubTicker />
          </div>
        </div>

        {/* Projects Section - like reference 1 */}
        <div className="relative -mb-24 pb-32 mt-8 z-10">
          <section id="projects" className="relative z-10">
            <RecentProjects mode={mode} />
          </section>
        </div>

        {/* Hidden Arcade Icon */}
        <button
          onClick={() => navigate('/playground')}
          className="fixed bottom-4 right-4 p-2 opacity-[0.05] hover:opacity-20 transition-opacity duration-500 z-50"
          aria-label="Secret Arcade"
        >
          <Gamepad2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
