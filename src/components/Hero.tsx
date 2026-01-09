
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHeroContent } from '@/hooks/useHeroContent';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import TypewriterText from '@/components/TypewriterText';

interface HeroProps {
  mode: 'professional' | 'creative';
}

const Hero = ({ mode }: HeroProps) => {
  const navigate = useNavigate();
  const { data: heroContent = [] } = useHeroContent(mode);
  const { data: siteSettings } = useSiteSettings();
  
  // Use the first hero content entry for the current mode, or fallback to defaults
  const content = heroContent[0] || {
    greeting: mode === 'professional' ? "Hello, I'm" : "Hey there! I'm",
    name: "Your Name",
    title: mode === 'professional' ? "Full Stack Developer & Software Engineer" : "Creative Designer & Content Creator",
    description: mode === 'professional' 
      ? "Passionate about creating innovative solutions with modern technologies. Specialized in React, TypeScript, and scalable web applications."
      : "Bringing ideas to life through graphic design, video editing, and creative storytelling. Let's create something amazing together!",
    cta_text: mode === 'professional' ? "View My Work" : "Explore Creativity",
    cta_link: '/projects',
    animated_titles: mode === 'professional' 
      ? ["Full Stack Developer", "Software Engineer", "Web Developer"] 
      : ["Creative Designer", "Content Creator", "Visual Artist"],
    background_image_url: undefined,
    profile_photo_url: undefined,
    animation_speed: 30,
    animation_pause_duration: 500,
    gradient_overlay_opacity: 0.7
  };

  const handleCtaClick = () => {
    const link = content.cta_link || '/projects';
    if (link.startsWith('http')) {
      window.open(link, '_blank');
    } else {
      navigate(link);
    }
  };

  const handleDownloadCV = () => {
    if (siteSettings?.resume_url) {
      // Convert Google Drive view link to download link if needed
      let downloadUrl = siteSettings.resume_url;
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
      className="min-h-screen flex items-center px-4 sm:px-6 md:px-8 relative overflow-visible pt-8 md:pt-0 pb-24 md:pb-0"
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
            {/* Profile Photo - First on mobile */}
            {content.profile_photo_url && (
              <div className="md:hidden flex justify-center order-first mb-8 mt-16">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  className="avatar-float w-40 h-40 sm:w-48 sm:h-48"
                >
                  <img
                    src={content.profile_photo_url}
                    alt={content.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                </motion.div>
              </div>
            )}
            
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
                    <ArrowDown className="ml-2 h-5 w-5" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-3 text-lg"
                    onClick={handleDownloadCV}
                    disabled={!siteSettings?.resume_url}
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Download CV
                  </Button>
                </motion.div>
              </motion.div>
            </div>

            {/* Right side - Profile Photo (5 columns) - Desktop only */}
            {content.profile_photo_url && (
              <div className="hidden md:flex md:col-span-5 justify-center md:justify-end">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="avatar-float w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-80 lg:h-80 xl:w-96 xl:h-96"
                >
                  <img
                    src={content.profile_photo_url}
                    alt={content.name}
                    className="w-full h-full object-cover rounded-full"
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
