import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, MapPin, Building2, Award, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import ProjectImageGallery from '@/components/ProjectImageGallery';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useExperience } from '@/hooks/useExperience';
import { Experience } from '@/types/cms';
import ReactMarkdown from 'react-markdown';
import { usePageMeta } from '@/hooks/usePageMeta';
import { getModePath } from '@/lib/modePath';
import { experienceMeta } from '@/lib/seo';

const ExperienceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mode, defaultMode, darkMode } = usePortfolio();
  const { experiences, loading } = useExperience(mode);
  const [experience, setExperience] = useState<Experience | null>(null);

  useEffect(() => {
    if (experiences && id) {
      // Try by slug first, then fall back to UUID (same pattern as ProjectDetail).
      const found = experiences.find(exp => exp.slug === id) ?? experiences.find(exp => exp.id === id);
      setExperience(found || null);
    }
  }, [experiences, id]);

  // Get prev/next experiences for navigation
  const { prevExperience, nextExperience } = useMemo(() => {
    if (!experiences || !experience) return { prevExperience: null, nextExperience: null };
    const currentIndex = experiences.findIndex(exp => exp.id === experience.id);
    return {
      prevExperience: currentIndex > 0 ? experiences[currentIndex - 1] : null,
      nextExperience: currentIndex < experiences.length - 1 ? experiences[currentIndex + 1] : null,
    };
  }, [experiences, experience]);

  const getCertificateUrl = (exp: Experience) => {
    if (exp.certificate_url) return exp.certificate_url;
    if (exp.certificate_drive_id) return `https://drive.google.com/file/d/${exp.certificate_drive_id}/view`;
    return null;
  };

  const getDisplayDate = (exp: Experience) => {
    if (exp.date_type === 'single' && exp.event_date) return exp.event_date;
    return exp.period;
  };

  usePageMeta(experienceMeta(mode, defaultMode, experience));

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <CursorFollower />
        <RadialGradient scale="scale-y-100" opacity={darkMode ? "opacity-30" : "opacity-30"} />
        <Navigation />
        <div className="pt-20 px-4">
          <div className="container mx-auto py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading experience...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!experience) {
    return (
      <div className="min-h-screen bg-background">
        <CursorFollower />
        <RadialGradient scale="scale-y-100" opacity={darkMode ? "opacity-30" : "opacity-30"} />
        <Navigation />
        <div className="pt-20 px-4">
          <div className="container mx-auto py-12 text-center">
            <h1 className="text-2xl font-bold mb-4">Experience Not Found</h1>
            <p className="text-muted-foreground mb-6">The experience you're looking for doesn't exist.</p>
            <Button onClick={() => navigate(getModePath(mode, defaultMode, '/experience'))}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Experience
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const certificateUrl = getCertificateUrl(experience);
  const hasImages = experience.event_images && experience.event_images.length > 0;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <CursorFollower />
      <RadialGradient scale="scale-y-100" opacity={darkMode ? "opacity-30" : "opacity-30"} overflow="overflow-hidden" />
      <Navigation />

      <div className="pt-16 sm:pt-20 px-3 sm:px-4">
        <div className="container mx-auto py-6 sm:py-12 max-w-4xl">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6"
          >
            <Button variant="ghost" onClick={() => navigate(getModePath(mode, defaultMode, '/experience'))} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Experience
            </Button>
          </motion.div>

          {/* Image Gallery */}
          {hasImages && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-8"
            >
              <ProjectImageGallery 
                images={experience.event_images || []} 
                title={experience.title}
                mode={mode}
              />
            </motion.div>
          )}

          {/* Experience Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            {/* Role Badge + Title */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {experience.role && (
                <Badge className={`text-sm ${
                  mode === 'creative' 
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
                    : 'bg-primary/20 text-primary border-primary/30'
                }`}>
                  {experience.role}
                </Badge>
              )}
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">{experience.title}</h1>
            </div>

            {/* Company/Venue */}
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground mb-4">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {experience.company}
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {experience.location}
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {getDisplayDate(experience)}
              </span>
            </div>

            {/* Certificate Button */}
            {certificateUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(certificateUrl, '_blank')}
                className="gap-2"
              >
                <Award className="w-4 h-4" />
                View Certificate
              </Button>
            )}
          </motion.div>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold mb-3">About</h2>
            {mode === 'creative' ? (
              <div className="text-muted-foreground leading-relaxed prose-headings:text-foreground prose-strong:text-foreground">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    u: ({ children }) => <u className="underline">{children}</u>,
                    h2: ({ children }) => <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc ml-4 space-y-1 my-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal ml-4 space-y-1 my-2">{children}</ol>,
                    li: ({ children }) => <li>{children}</li>,
                  }}
                >
                  {experience.description}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-muted-foreground leading-relaxed">{experience.description}</p>
            )}
          </motion.div>

          {/* Achievements/Highlights */}
          {experience.achievements && experience.achievements.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mb-8"
            >
              <h2 className="text-lg font-semibold mb-3">
                {mode === 'creative' ? 'Highlights' : 'Achievements'}
              </h2>
              <div className="flex flex-wrap gap-2">
                {experience.achievements.map((achievement, index) => (
                  <Badge key={index} variant="secondary" className="text-sm">
                    {achievement}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}

          {/* Navigation */}
          <div className="border-t border-border pt-8">
            <div className="flex justify-between items-center">
              {prevExperience ? (
                <Link to={getModePath(mode, defaultMode, `/experience/${prevExperience.slug || prevExperience.id}`)} className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <div className="text-left">
                    <div className="text-xs text-muted-foreground">Previous</div>
                    <div className="text-sm font-medium">{prevExperience.title}</div>
                  </div>
                </Link>
              ) : (
                <div />
              )}
              {nextExperience ? (
                <Link to={getModePath(mode, defaultMode, `/experience/${nextExperience.slug || nextExperience.id}`)} className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-right">
                  <div>
                    <div className="text-xs text-muted-foreground">Next</div>
                    <div className="text-sm font-medium">{nextExperience.title}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExperienceDetail;
