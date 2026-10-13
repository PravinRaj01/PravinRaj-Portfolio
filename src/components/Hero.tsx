
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHeroContent } from '@/hooks/useHeroContent';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import TypewriterText from '@/components/TypewriterText';
import HangingCard from '@/components/HangingCard';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { getModePath } from '@/lib/modePath';

interface HeroProps {
  mode: 'professional' | 'creative';
}

const Hero = ({ mode }: HeroProps) => {
  const navigate = useNavigate();
  const { defaultMode } = usePortfolio();
  const { data: heroContent = [], isLoading: isHeroLoading } = useHeroContent(mode);
  const { data: siteSettings } = useSiteSettings();

  // Only true on a first-ever visit with nothing cached yet (see
  // useHeroContent.ts's localStorage initialData) -- everyone else gets
  // real content immediately, even before the network responds. This is
  // what stops "Your Name" / "Full Stack Developer" from ever being shown
  // as if it were real: that fallback below is for a genuinely empty
  // hero_content table, not "still loading".
  if (isHeroLoading && heroContent.length === 0) {
    return (
      <section
        className="min-h-screen flex items-center px-4 sm:px-6 md:px-8 relative overflow-visible pt-8 md:pt-0 pb-8 md:pb-0"
        style={{ touchAction: 'pan-y' }}
      >
        <div
          className={`absolute inset-0 ${
            mode === 'creative'
              ? 'bg-gradient-to-br from-[#1a2238]/70 via-[#ff6a3d]/30 to-[#1a2238]/70'
              : 'bg-gradient-to-br from-purple-900/70 via-blue-900/50 to-purple-900/70'
          }`}
        />
        <div className="container mx-auto relative z-10">
          <div className="max-w-7xl">
            <div className="md:col-span-7 space-y-4 md:space-y-6 max-w-3xl">
              <div className="h-6 w-32 rounded bg-white/10 animate-pulse" />
              <div className="h-12 md:h-16 w-3/4 rounded bg-white/10 animate-pulse" />
              <div className="h-8 md:h-10 w-2/3 rounded bg-white/10 animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-full rounded bg-white/10 animate-pulse" />
                <div className="h-5 w-5/6 rounded bg-white/10 animate-pulse" />
              </div>
              <div className="flex gap-4 pt-4">
                <div className="h-12 w-40 rounded bg-white/10 animate-pulse" />
                <div className="h-12 w-40 rounded bg-white/10 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Use the first hero content entry for the current mode, or fallback to
  // defaults -- reached only once loading has actually finished, so this
  // fallback now means "the table really is empty," not "still fetching."
  const content = heroContent[0] || {
    greeting: mode === 'professional' ? "Hello, I'm" : "Hey there! I'm",
    name: "Your Name",
    title: mode === 'professional' ? "Full Stack Developer & Software Engineer" : "Creative Designer & Content Creator",
    description: mode === 'professional' 
      ? "Passionate about creating innovative solutions with modern technologies. Specialized in React, TypeScript, and scalable web applications."
      : "Bringing ideas to life through graphic design, video editing, and creative storytelling. Let's create something amazing together!",
    cta_text: mode === 'professional' ? "View My Work" : "Explore Creativity",
    cta_link: getModePath(mode, defaultMode, '/projects'),
    animated_titles: mode === 'professional' 
      ? ["Full Stack Developer", "Software Engineer", "Web Developer"] 
      : ["Creative Designer", "Content Creator", "Visual Artist"],
    background_image_url: undefined,
    profile_photo_url: undefined,
    animation_speed: 30,
    animation_pause_duration: 500,
    gradient_overlay_opacity: 0.7,
    birth_date: null,
    fun_facts: null
  };

  const handleCtaClick = () => {
    // '/projects' is the local (non-CMS) fallback default, resolved to the
    // current mode's projects page. A CMS-configured cta_link (admin-editable)
    // is passed through as-is — out of scope for this migration.
    const link = content.cta_link || getModePath(mode, defaultMode, '/projects');
    if (link.startsWith('http')) {
      window.open(link, '_blank');
    } else {
      navigate(link);
    }
  };

  const currentResumeUrl = mode === 'professional'
    ? (siteSettings?.professional_resume_url || siteSettings?.resume_url)
    : (siteSettings?.creative_resume_url || siteSettings?.resume_url);

  const handleDownloadCV = () => {
    if (currentResumeUrl) {
      // Convert Google Drive view link to download link if needed
      let downloadUrl = currentResumeUrl;
      if (downloadUrl.includes('drive.google.com/file/d/') && downloadUrl.includes('/view')) {
        // Convert Google Drive view link to direct download link
        const fileId = downloadUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
        if (fileId) {
          downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'resume.pdf'; // Suggest filename for download
      link.target = '_blank'; // Fallback: open in new tab if download fails
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <section 
      className="min-h-screen flex items-center px-4 sm:px-6 md:px-8 relative overflow-visible pt-8 md:pt-0 pb-8 md:pb-0"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Background Image */}
      {content.background_image_url && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${content.background_image_url})` }}
        />
      )}
      
      {/* Background gradient overlay - mode-aware colors */}
      <div 
        className={`absolute inset-0 ${
          mode === 'creative' 
            ? 'bg-gradient-to-br from-[#1a2238]/70 via-[#ff6a3d]/30 to-[#1a2238]/70'
            : 'bg-gradient-to-br from-purple-900/70 via-blue-900/50 to-purple-900/70'
        }`}
        style={{ 
          opacity: content.gradient_overlay_opacity || 0.7 
        }}
      />
      
      <div className="container mx-auto relative z-10">
        <div className="max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left side - Text content (7 columns) */}
            <div className="md:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                {/* Greeting */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className={`text-lg md:text-xl mb-4 ${
                    mode === 'creative' ? 'text-[#ebebeb]' : 'text-white/90'
                  }`}
                >
                  {content.greeting}
                </motion.p>

                {/* Name */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 ${
                    mode === 'creative' ? 'text-white' : 'text-white'
                  }`}
                >
                  {content.name}
                </motion.h1>

                {/* Animated Title (Designation) - Always use animated_titles if available, otherwise fallback to title */}
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-mono mb-6 md:mb-8 min-h-[2.5rem] md:min-h-[3rem] flex items-center ${
                    mode === 'creative' ? 'text-[#ff6a3d]' : 'text-gray-300'
                  }`}
                >
                  <TypewriterText 
                    key={mode} // Force reset when mode changes
                    texts={
                      content.animated_titles && content.animated_titles.length > 0 
                        ? content.animated_titles 
                        : [content.title || 'Your Designation']
                    }
                    speed={content.animation_speed || 100}
                    deleteSpeed={50}
                    pauseDuration={content.animation_pause_duration || 1500}
                  />
                </motion.h2>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.8 }}
                  className="text-base md:text-lg lg:text-xl text-white/80 mb-8 md:mb-12 max-w-3xl leading-relaxed"
                  style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', hyphens: 'none' }}
                >
                  {content.description}
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.8 }}
                  className="flex flex-col sm:flex-row gap-4 items-start"
                >
                  <Button
                    size="lg"
                    className="bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 text-white px-8 py-3 text-lg transition-all cursor-pointer"
                    onClick={handleCtaClick}
                  >
                    {content.cta_text}

                  </Button>
                  
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-3 text-lg"
                    onClick={handleDownloadCV}
                    disabled={!currentResumeUrl}
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Download CV
                  </Button>
                </motion.div>
              </motion.div>
            </div>

            {/* Right side - Hanging ID card (5 columns), first on mobile */}
            {(content.profile_photo_url || content.name) && (
              <div className="order-first md:order-none md:col-span-5 flex justify-center md:justify-end mt-16 md:mt-0">
                {/* Opacity only -- the card's own physics does the entrance
                    (it swings in), and a scale transform here would distort
                    the strap-anchor measurement HangingCard takes on mount. */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                >
                  <HangingCard
                    name={content.name}
                    title={content.title}
                    photoUrl={content.profile_photo_url}
                    birthDate={content.birth_date}
                    funFacts={content.fun_facts}
                    mode={mode}
                  />
                </motion.div>
              </div>
            )}
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center"
          >
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1 h-3 bg-white/50 rounded-full mt-2"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
