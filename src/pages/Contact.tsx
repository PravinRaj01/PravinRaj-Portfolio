
import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Github, Linkedin, Twitter, Instagram, Youtube, Facebook, Globe, ExternalLink } from 'lucide-react';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useContactContent } from '@/hooks/useContactContent';
import { useEnabledSocials } from '@/hooks/useSocials';

const Contact = () => {
  const { mode, darkMode } = usePortfolio();
  const { data: contactContent } = useContactContent(mode);
  const { data: socials = [] } = useEnabledSocials();

  // Fallback data if no content is available
  const fallbackData = {
    title: 'Get In Touch',
    subtitle: "Open to new opportunities, collaborations, and exciting projects. Let's connect!",
    email: 'hello@portfolio.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    services: mode === 'professional' 
      ? ['Full-Stack Development', 'Frontend Development', 'Backend Development', 'Technical Consulting', 'Code Review']
      : ['Graphic Design', 'Video Editing', 'Brand Identity', 'Content Creation', 'Creative Consulting']
  };

  const content = contactContent || fallbackData;

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    github: Github,
    linkedin: Linkedin,
    twitter: Twitter,
    instagram: Instagram,
    youtube: Youtube,
    facebook: Facebook,
    globe: Globe,
  };

  const getIconComponent = (iconName: string) => {
    return iconMap[iconName.toLowerCase()] || Globe;
  };

  // Check if URL is valid/not weird
  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <CursorFollower />
      <RadialGradient 
        scale="scale-y-100" 
        opacity={darkMode ? "opacity-30" : "opacity-30"} 
      />
      <Navigation />

      <div className="pt-16 sm:pt-20 px-3 sm:px-4">
        <div className="container mx-auto py-6 sm:py-12 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-6 sm:mb-12 lg:mb-16"
          >
            <h1 className={`text-2xl sm:text-4xl md:text-6xl font-bold mb-2 sm:mb-4 pb-2 bg-gradient-to-r ${
              mode === 'creative' 
                ? 'from-orange-500 to-orange-600' 
                : 'from-blue-600 to-purple-600'
            } bg-clip-text text-transparent`}>
              {content.title}
            </h1>
            <p className="text-sm sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
              {content.subtitle}
            </p>
          </motion.div>

          {/* Mobile: Compact Icon-Focused Bento Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4"
          >
            {/* Email - Full width on mobile */}
            <motion.a
              variants={itemVariants}
              href={`mailto:${content.email}`}
              className="col-span-2 group relative overflow-hidden rounded-xl sm:rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl p-3 sm:p-5 lg:p-6 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
              whileHover={{ scale: 1.02, y: -4 }}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`p-2.5 sm:p-4 rounded-xl backdrop-blur-sm ${
                  mode === 'creative' 
                    ? 'bg-orange-500/10 group-hover:bg-orange-500/20' 
                    : 'bg-primary/10 group-hover:bg-primary/20'
                } transition-colors`}>
                  <Mail className={`w-5 h-5 sm:w-7 sm:h-7 ${
                    mode === 'creative' ? 'text-orange-500' : 'text-primary'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">Email</p>
                  <p className="text-sm sm:text-lg font-semibold group-hover:text-primary transition-colors truncate">{content.email}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hidden sm:block" />
              </div>
            </motion.a>

            {/* Phone - Half width on mobile */}
            {content.phone && (
              <motion.a
                variants={itemVariants}
                href={`tel:${content.phone.replace(/\D/g, '')}`}
                className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/30 backdrop-blur-xl p-3 sm:p-5 hover:border-primary/50 transition-all duration-300"
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-2 sm:gap-3">
                  <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl backdrop-blur-sm ${
                    mode === 'creative' 
                      ? 'bg-orange-500/10 group-hover:bg-orange-500/20' 
                      : 'bg-primary/10 group-hover:bg-primary/20'
                  } transition-colors`}>
                    <Phone className={`w-5 h-5 sm:w-6 sm:h-6 ${
                      mode === 'creative' ? 'text-orange-500' : 'text-primary'
                    }`} />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">Phone</p>
                    <p className="text-xs sm:text-base font-semibold group-hover:text-primary transition-colors">{content.phone}</p>
                  </div>
                </div>
              </motion.a>
            )}

            {/* Location - Half width on mobile */}
            {content.location && (
              <motion.a
                variants={itemVariants}
                href={`https://maps.google.com/maps?q=${encodeURIComponent(content.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/30 backdrop-blur-xl p-3 sm:p-5 hover:border-primary/50 transition-all duration-300"
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-2 sm:gap-3">
                  <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl backdrop-blur-sm ${
                    mode === 'creative' 
                      ? 'bg-orange-500/10 group-hover:bg-orange-500/20' 
                      : 'bg-primary/10 group-hover:bg-primary/20'
                  } transition-colors`}>
                    <MapPin className={`w-5 h-5 sm:w-6 sm:h-6 ${
                      mode === 'creative' ? 'text-orange-500' : 'text-primary'
                    }`} />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">Location</p>
                    <p className="text-xs sm:text-base font-semibold group-hover:text-primary transition-colors line-clamp-2">{content.location}</p>
                  </div>
                </div>
              </motion.a>
            )}

            {/* Social Links - Icon-focused compact cards */}
            {socials.map((social) => {
              const IconComponent = getIconComponent(social.icon);
              const hasValidUrl = isValidUrl(social.url);
              
              const CardContent = (
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-2 sm:gap-3">
                  <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl backdrop-blur-sm ${
                    mode === 'creative' 
                      ? 'bg-orange-500/10 group-hover:bg-orange-500/20' 
                      : 'bg-primary/10 group-hover:bg-primary/20'
                  } transition-colors`}>
                    <IconComponent className={`w-5 h-5 sm:w-6 sm:h-6 ${
                      mode === 'creative' ? 'text-orange-500' : 'text-primary'
                    }`} />
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-xs sm:text-base font-semibold group-hover:text-primary transition-colors truncate">{social.name}</p>
                    {hasValidUrl && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate hidden sm:block">{new URL(social.url).hostname}</p>
                    )}
                  </div>
                </div>
              );

              if (hasValidUrl) {
                return (
                  <motion.a
                    key={social.id}
                    variants={itemVariants}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/30 backdrop-blur-xl p-3 sm:p-5 hover:border-primary/50 transition-all duration-300"
                    whileHover={{ scale: 1.02, y: -4 }}
                  >
                    {CardContent}
                    <ExternalLink className="absolute top-2 right-2 sm:top-3 sm:right-3 w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.a>
                );
              }

              return (
                <motion.div
                  key={social.id}
                  variants={itemVariants}
                  className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/30 backdrop-blur-xl p-3 sm:p-5"
                >
                  {CardContent}
                </motion.div>
              );
            })}

            {/* Available For / Services - Full width */}
            {content.services && content.services.length > 0 && (
              <motion.div
                variants={itemVariants}
                className="col-span-2 lg:col-span-3 rounded-xl sm:rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl p-3 sm:p-5 lg:p-6"
              >
                <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2 sm:mb-4">
                  {mode === 'professional' ? 'Available For' : 'Services Offered'}
                </h3>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 lg:gap-3">
                  {content.services.map((service) => (
                    <span
                      key={service}
                      className={`px-2 py-1 sm:px-3 sm:py-1.5 lg:px-4 lg:py-2 rounded-full text-[10px] sm:text-xs lg:text-sm font-medium backdrop-blur-sm ${
                        mode === 'creative'
                          ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                          : 'bg-primary/10 text-primary border border-primary/20'
                      }`}
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
