import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Building2, ArrowUpDown, Award, ArrowRight, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import ExperienceModeBanner from '@/components/ExperienceModeBanner';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useExperience } from '@/hooks/useExperience';
import { Experience as ExperienceType } from '@/types/cms';
import ReactMarkdown from 'react-markdown';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { usePageMeta } from '@/hooks/usePageMeta';

const Experience = () => {
  const navigate = useNavigate();
  // Persist view mode in localStorage
  const [viewMode, setViewMode] = useState<'timeline' | 'cards'>(() => {
    const saved = localStorage.getItem('experience-view-mode');
    return (saved as 'timeline' | 'cards') || 'timeline';
  });
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const { mode, darkMode } = usePortfolio();

  usePageMeta({
    title: 'Experience — Pravin Raj Muralitharan',
    description: 'Professional experience and achievements of Pravin Raj — AI engineering roles, design work, and leadership across industry and academia.',
    url: 'https://pravinraj.dev/experience',
  });
  const { experiences, loading } = useExperience(mode);
  const timelineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isCreativeMode = mode === 'creative';

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('experience-view-mode', viewMode);
  }, [viewMode]);

  const roles = useMemo(() => {
    if (!isCreativeMode || !experiences) return [];
    const uniqueRoles = [...new Set(experiences.map(exp => exp.role).filter(Boolean))] as string[];
    return uniqueRoles;
  }, [experiences, isCreativeMode]);

  // Helper functions
  const getCertificateUrl = (exp: ExperienceType) => {
    if (exp.certificate_url) return exp.certificate_url;
    if (exp.certificate_drive_id) return `https://drive.google.com/file/d/${exp.certificate_drive_id}/view`;
    return null;
  };

  const getDisplayDate = (exp: ExperienceType) => {
    if (exp.date_type === 'single' && exp.event_date) return exp.event_date;
    return exp.period;
  };

  const hasDetails = (exp: ExperienceType) => {
    return (exp.event_images && exp.event_images.length > 0) || getCertificateUrl(exp);
  };

  const handleCardClick = (exp: ExperienceType) => {
    // All experiences are clickable to view full details
    navigate(`/experience/${exp.id}`);
  };

  // Parse date for sorting - supports both period range and event_date
  const parseExperienceDate = (exp: ExperienceType): Date => {
    const monthMap: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };

    // For creative mode with single event date, use event_date
    if (exp.date_type === 'single' && exp.event_date) {
      // Parse formats like "15 Jan 2024" or "Jan 2024"
      const parts = exp.event_date.trim().split(' ');
      if (parts.length === 3) {
        // "15 Jan 2024" format
        const day = parseInt(parts[0]);
        const month = monthMap[parts[1]] ?? 0;
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      } else if (parts.length === 2) {
        // "Jan 2024" format
        const month = monthMap[parts[0]] ?? 0;
        const year = parseInt(parts[1]);
        return new Date(year, month, 1);
      }
    }
    
    // Fallback to parsing period (e.g., "Aug 2023 - Jan 2024")
    const startPart = exp.period.split(' - ')[0].trim();
    const [month, year] = startPart.split(' ');
    return new Date(parseInt(year), monthMap[month] || 0, 1);
  };

  // Filter and sort experiences
  const sortedExperiences = useMemo(() => {
    if (!experiences) return [];
    
    // Filter by role if in creative mode and role is selected
    let filtered = experiences;
    if (isCreativeMode && selectedRole !== 'all') {
      filtered = experiences.filter(exp => exp.role === selectedRole);
    }
    
    const sorted = [...filtered].sort((a, b) => {
      const dateA = parseExperienceDate(a);
      const dateB = parseExperienceDate(b);
      return sortOrder === 'newest' 
        ? dateB.getTime() - dateA.getTime() 
        : dateA.getTime() - dateB.getTime();
    });
    return sorted;
  }, [experiences, sortOrder, selectedRole, isCreativeMode]);

  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    const newIndex = direction === 'up' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(sortedExperiences.length - 1, currentIndex + 1);
    
    setCurrentIndex(newIndex);
    timelineRefs.current[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentIndex, sortedExperiences.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <CursorFollower />
        <RadialGradient 
          scale="scale-y-100" 
          opacity={darkMode ? "opacity-30" : "opacity-30"} 
        />
        <Navigation />
        <div className="pt-20 px-4">
          <div className="container mx-auto py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading experiences...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <CursorFollower />
      <RadialGradient 
        scale="scale-y-100" 
        opacity={darkMode ? "opacity-30" : "opacity-30"} 
      />
      <Navigation />

      <div className="pt-16 sm:pt-20 px-3 sm:px-4">
        <div className="container mx-auto py-6 sm:py-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8 sm:mb-16"
          >
            <h1 className={`text-2xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 pb-2 bg-gradient-to-r ${
              mode === 'creative' 
                ? 'from-orange-500 to-orange-600' 
                : 'from-blue-600 to-purple-600'
            } bg-clip-text text-transparent`}>
              {mode === 'professional' ? 'Professional Experience' : 'Speaking & Judging Experience'}
            </h1>
            <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
              {mode === 'professional' 
                ? 'My professional journey in software development and technology'
                : 'My experience as a speaker, judge, and creative industry contributor'
              }
            </p>

            {/* Mode Switch Banner for Creative Mode */}
            <ExperienceModeBanner />
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {/* View Mode Toggle - compact toggle group */}
              <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1">
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                    viewMode === 'timeline' 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                    viewMode === 'cards' 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cards
                </button>
              </div>

              {/* Sort Order - compact select */}
              <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest') => setSortOrder(value)}>
                <SelectTrigger className="w-[120px] sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                  <ArrowUpDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                </SelectContent>
              </Select>

              {/* Role/Position Filter - Creative Mode Only */}
              {isCreativeMode && roles.length > 0 && (
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-[120px] sm:w-[150px] h-8 sm:h-9 text-xs sm:text-sm">
                    <Filter className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5" />
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Positions</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </motion.div>

          {sortedExperiences.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {selectedRole !== 'all' 
                  ? `No experiences found for position "${selectedRole}".`
                  : `No experiences found for ${mode} mode.`
                }
              </p>
              {selectedRole !== 'all' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => setSelectedRole('all')}
                >
                  Clear Filter
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Timeline View */}
              {viewMode === 'timeline' && (
                <div className="relative">
                  <div className="absolute left-3 sm:left-4 md:left-8 top-0 bottom-0 w-0.5 bg-border"></div>
                  <div className="space-y-4 sm:space-y-8 md:space-y-12">
                    {sortedExperiences.map((exp, index) => {
                      const certificateUrl = getCertificateUrl(exp);
                      const clickable = true; // All experiences are clickable
                      
                      return (
                        <motion.div
                          key={exp.id}
                          ref={(el) => { timelineRefs.current[index] = el; }}
                          initial={{ opacity: 0, x: -30 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.6, delay: index * 0.2 }}
                          viewport={{ once: true }}
                          className="relative pl-8 sm:pl-10 md:pl-16"
                          onViewportEnter={() => setCurrentIndex(index)}
                        >
                          <div className={`absolute left-1 sm:left-2 md:left-6 w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 sm:border-4 border-background transition-all ${
                            currentIndex === index ? 'bg-primary scale-125' : 'bg-primary/60'
                          }`}></div>
                          <Card 
                            className={`hover:shadow-lg transition-shadow flex flex-col ${clickable ? 'cursor-pointer hover:border-primary/50' : ''}`}
                            onClick={() => handleCardClick(exp)}
                          >
                            <CardHeader className="p-3 sm:p-4 md:p-6">
                              <div className="flex flex-col gap-2">
                            {/* Creative Mode: Role badge above Event Name */}
                                {isCreativeMode ? (
                                  <div className="flex flex-col gap-1.5 mb-1">
                                    {exp.role && (
                                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs sm:text-sm w-fit">
                                        {exp.role}
                                      </Badge>
                                    )}
                                    <CardTitle className="text-base sm:text-lg md:text-xl">{exp.title}</CardTitle>
                                  </div>
                                ) : (
                                  <CardTitle className="text-base sm:text-lg md:text-xl mb-1 sm:mb-2">{exp.title}</CardTitle>
                                )}
                                <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm md:text-base min-w-0">
                                  <span className="flex items-center min-w-0">
                                    <Building2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                    <span className="min-w-0 break-normal">{exp.company}</span>
                                  </span>
                                  <span className="flex items-center min-w-0">
                                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                    <span className="min-w-0 break-normal">{exp.location}</span>
                                  </span>
                                </CardDescription>
                                {/* Professional Mode: Show role separately */}
                                {!isCreativeMode && exp.role && (
                                  <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                                    <span className="px-2 py-0.5 bg-primary/10 rounded-full">
                                      {exp.role}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                  {getDisplayDate(exp)}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="p-3 sm:p-4 md:p-6 pt-0 sm:pt-0 md:pt-0 min-w-0 overflow-hidden flex flex-col flex-1">
                              <div className="flex-1">
                                <div className="text-xs sm:text-sm md:text-base text-muted-foreground mb-3 sm:mb-4 line-clamp-3">
                                  <ReactMarkdown
                                    components={{
                                      p: ({ children }) => <span>{children}</span>,
                                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                                      em: ({ children }) => <em>{children}</em>,
                                    }}
                                  >
                                    {exp.description}
                                  </ReactMarkdown>
                                </div>
                                <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
                                  {exp.achievements?.map((achievement, achievementIndex) => (
                                    <span
                                      key={achievementIndex}
                                      className="w-full sm:w-auto max-w-full px-2 py-0.5 sm:px-3 sm:py-1 bg-primary/10 text-primary rounded-full text-xs sm:text-sm whitespace-normal break-normal leading-snug"
                                    >
                                      {achievement}
                                    </span>
                                  ))}
                                </div>
                                {/* Mini Image Preview Strip - Creative Mode */}
                                {isCreativeMode && exp.event_images && exp.event_images.length > 0 && (
                                  <div className="flex gap-1 mb-3 overflow-hidden">
                                    {exp.event_images.slice(0, 4).map((img, idx) => (
                                      <img
                                        key={idx}
                                        src={img.startsWith('http') ? img : generateDriveImageUrl(img, 'small')}
                                        alt={`Event ${idx + 1}`}
                                        className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-sm flex-shrink-0"
                                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                                      />
                                    ))}
                                    {exp.event_images.length > 4 && (
                                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-sm flex items-center justify-center text-[10px] text-muted-foreground flex-shrink-0">
                                        +{exp.event_images.length - 4}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              {/* Action buttons - always at bottom */}
                              <div className="flex flex-wrap gap-2 pt-2 border-t border-border mt-auto">
                                {certificateUrl && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(certificateUrl, '_blank');
                                    }}
                                    className="gap-1.5 text-xs"
                                  >
                                    <Award className="w-3 h-3" />
                                    View Certificate
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/experience/${exp.id}`);
                                  }}
                                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  View Details
                                  <ArrowRight className="w-3 h-3" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cards View */}
              {viewMode === 'cards' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                  {sortedExperiences.map((exp, index) => {
                    const certificateUrl = getCertificateUrl(exp);
                    const clickable = true; // All experiences are clickable
                    
                    return (
                      <motion.div
                        key={exp.id}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                        viewport={{ once: true }}
                      >
                        <Card 
                          className={`h-full hover:shadow-lg transition-shadow flex flex-col ${clickable ? 'cursor-pointer hover:border-primary/50' : ''}`}
                          onClick={() => handleCardClick(exp)}
                        >
                          <CardHeader className="p-3 sm:p-4 md:p-6">
                          {/* Creative Mode: Role badge above Event Name */}
                            {isCreativeMode ? (
                              <div className="flex flex-col gap-1.5 mb-2">
                                {exp.role && (
                                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs w-fit">
                                    {exp.role}
                                  </Badge>
                                )}
                                <CardTitle className="text-base sm:text-lg">{exp.title}</CardTitle>
                              </div>
                            ) : (
                              <CardTitle className="text-base sm:text-lg">{exp.title}</CardTitle>
                            )}
                            <CardDescription className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm">
                              <div className="flex items-center">
                                <Building2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                {exp.company}
                              </div>
                              <div className="flex items-center">
                                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                {exp.location}
                              </div>
                              {!isCreativeMode && exp.role && (
                                <div className="text-muted-foreground">
                                  Role: {exp.role}
                                </div>
                              )}
                              <div className="flex items-center text-primary font-medium">
                                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                {getDisplayDate(exp)}
                              </div>
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="p-3 sm:p-4 md:p-6 pt-0 flex flex-col flex-1">
                            <div className="flex-1">
                              <div className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-3 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:mt-0.5">
                                <ReactMarkdown
                                  components={{
                                    p: ({ children }) => <span>{children}</span>,
                                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                                    em: ({ children }) => <em>{children}</em>,
                                    ul: ({ children }) => <ul className="list-disc ml-4">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal ml-4">{children}</ol>,
                                    li: ({ children }) => <li className="mt-0.5">{children}</li>,
                                    a: ({ children, href }) => <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                                  }}
                                >
                                  {exp.description}
                                </ReactMarkdown>
                              </div>
                              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
                                {exp.achievements?.map((achievement, achievementIndex) => (
                                  <span
                                    key={achievementIndex}
                                    className="max-w-full px-2 py-0.5 sm:py-1 bg-primary/10 text-primary rounded text-xs whitespace-normal break-normal leading-snug"
                                  >
                                    {achievement}
                                  </span>
                                ))}
                              </div>
                              {/* Mini Image Preview Strip - Creative Mode */}
                              {isCreativeMode && exp.event_images && exp.event_images.length > 0 && (
                                <div className="flex gap-1 mb-3 overflow-hidden">
                                  {exp.event_images.slice(0, 4).map((img, idx) => (
                                    <img
                                      key={idx}
                                      src={img.startsWith('http') ? img : generateDriveImageUrl(img, 'small')}
                                      alt={`Event ${idx + 1}`}
                                      className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-sm flex-shrink-0"
                                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                                    />
                                  ))}
                                  {exp.event_images.length > 4 && (
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-sm flex items-center justify-center text-[10px] text-muted-foreground flex-shrink-0">
                                      +{exp.event_images.length - 4}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Action buttons - always at bottom */}
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-border mt-auto">
                              {certificateUrl && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(certificateUrl, '_blank');
                                  }}
                                  className="gap-1.5 text-xs"
                                >
                                  <Award className="w-3 h-3" />
                                  View Certificate
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/experience/${exp.id}`);
                                }}
                                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                              >
                                View Details
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Experience;
