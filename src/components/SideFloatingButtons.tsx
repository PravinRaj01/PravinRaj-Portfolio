import React, { useState, useEffect, useMemo } from 'react';
import { Share2, X, Github, Linkedin, Mail, Twitter, Instagram, Youtube, Facebook, Globe, type LucideIcon } from 'lucide-react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useEnabledSocials } from '@/hooks/useSocials';

const SideFloatingButtons = () => {
  const { mode } = usePortfolio();
  const { data: socials, isLoading } = useEnabledSocials();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Map icon names to Lucide icons
  const iconMap: Record<string, LucideIcon> = {
    github: Github,
    linkedin: Linkedin,
    mail: Mail,
    email: Mail,
    twitter: Twitter,
    instagram: Instagram,
    youtube: Youtube,
    facebook: Facebook,
    globe: Globe,
  };

  // Get icon component for a social
  const getIconComponent = (iconName: string): LucideIcon => {
    const icon = iconMap[iconName.toLowerCase()];
    return icon || Globe; // Default to Globe if icon not found
  };

  // Sort socials by order_index - show all enabled socials
  const sortedSocials = useMemo(() => {
    if (!socials) return [];
    return [...socials]
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [socials]);

  // Button styling - mode-aware colors with frosty effect (use primary color instead of purple)
  const getButtonAccent = () => {
    return mode === 'creative' 
      ? 'hover:bg-orange-500/20 hover:border-orange-400/50' 
      : 'hover:bg-blue-500/20 hover:border-blue-400/50';
  };

  const getActiveButtonStyle = () => {
    return mode === 'creative' 
      ? 'bg-orange-500/30 border-orange-400/50' 
      : 'bg-blue-500/30 border-blue-400/50';
  };

  // Desktop: 14x14, Mobile: 10x10 - larger on desktop for better visibility
  const buttonBaseClass = `w-10 h-10 lg:w-14 lg:h-14 rounded-full bg-white/10 backdrop-blur-xl backdrop-saturate-150 border border-white/20 shadow-2xl flex items-center justify-center hover:scale-[1.15] active:scale-105 transition-all ${getButtonAccent()}`;

  // Don't render if still loading
  if (isLoading) {
    return null;
  }

  const toggleSocials = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="fixed left-4 md:left-6 lg:left-8 z-40 bottom-[4.5rem] lg:bottom-24">
      {/* Main Share Toggle Button */}
      <button
        className={`${buttonBaseClass} ${isOpen ? getActiveButtonStyle() : ''}`}
        onClick={toggleSocials}
        aria-label="Toggle Social Links"
      >
        {isOpen ? (
          <X className="w-4 h-4 lg:w-5 lg:h-5 transition-transform" />
        ) : (
          <Share2 className="w-4 h-4 lg:w-5 lg:h-5 transition-transform" />
        )}
      </button>

      {/* Socials expand upward vertically */}
      <div 
        className={`absolute bottom-14 lg:bottom-16 left-0 flex flex-col-reverse items-center gap-3 transition-all duration-300 ${
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {sortedSocials.map((social, index) => {
          const IconComponent = getIconComponent(social.icon);
          
          return (
            <a
              key={social.id}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonBaseClass}
              style={{
                transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
              }}
              aria-label={social.name}
            >
              <IconComponent className="w-4 h-4 lg:w-5 lg:h-5" />
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default SideFloatingButtons;