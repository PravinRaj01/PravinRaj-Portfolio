import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Building2, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useExperience } from '@/hooks/useExperience';

const Experience = () => {
  const [viewMode, setViewMode] = useState<'timeline' | 'cards'>('timeline');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [currentIndex, setCurrentIndex] = useState(0);
  const { mode, darkMode } = usePortfolio();
  const { experiences, loading } = useExperience(mode);
  const timelineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Parse period to get start date for sorting
  const parseStartDate = (period: string): Date => {
    // Extract the start date from period (e.g., "Aug 2023 - Jan 2024" or "Mar 2025 - Present")
    const startPart = period.split(' - ')[0].trim();
    const [month, year] = startPart.split(' ');
    const monthMap: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    return new Date(parseInt(year), monthMap[month] || 0, 1);
  };

  // Sort experiences based on period dates
  const sortedExperiences = useMemo(() => {
    if (!experiences) return [];
    const sorted = [...experiences].sort((a, b) => {
      const dateA = parseStartDate(a.period);
      const dateB = parseStartDate(b.period);
      return sortOrder === 'newest' 
        ? dateB.getTime() - dateA.getTime() 
        : dateA.getTime() - dateB.getTime();
    });
    return sorted;
  }, [experiences, sortOrder]);

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
            <h1 className={`text-2xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 bg-gradient-to-r ${
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

            {/* View Mode Toggle & Sort - Compact Style */}
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
            </div>
          </motion.div>

          {sortedExperiences.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No experiences found for {mode} mode.</p>
            </div>
          ) : (
            <>
              {/* Timeline View */}
              {viewMode === 'timeline' && (
                <div className="relative">
                  <div className="absolute left-3 sm:left-4 md:left-8 top-0 bottom-0 w-0.5 bg-border"></div>
                  <div className="space-y-4 sm:space-y-8 md:space-y-12">
                    {sortedExperiences.map((exp, index) => (
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
                        <Card className="hover:shadow-lg transition-shadow">
                          <CardHeader className="p-3 sm:p-4 md:p-6">
                            <div className="flex flex-col gap-2">
                              <div>
                                <CardTitle className="text-base sm:text-lg md:text-xl mb-1 sm:mb-2">{exp.title}</CardTitle>
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
                              </div>
                              <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                {exp.period}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 sm:p-4 md:p-6 pt-0 sm:pt-0 md:pt-0 min-w-0 overflow-hidden">
                            <p 
                              className="text-xs sm:text-sm md:text-base text-muted-foreground mb-3 sm:mb-4"
                              style={{ wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none' }}
                            >{exp.description}</p>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {exp.achievements.map((achievement, achievementIndex) => (
                                <span
                                  key={achievementIndex}
                                  className="w-full sm:w-auto max-w-full px-2 py-0.5 sm:px-3 sm:py-1 bg-primary/10 text-primary rounded-full text-xs sm:text-sm whitespace-normal break-normal leading-snug"
                                >
                                  {achievement}
                                </span>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cards View */}
              {viewMode === 'cards' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                  {sortedExperiences.map((exp, index) => (
                    <motion.div
                      key={exp.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <Card className="h-full hover:shadow-lg transition-shadow">
                        <CardHeader className="p-3 sm:p-4 md:p-6">
                          <CardTitle className="text-base sm:text-lg">{exp.title}</CardTitle>
                          <CardDescription className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm">
                            <div className="flex items-center">
                              <Building2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              {exp.company}
                            </div>
                            <div className="flex items-center">
                              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              {exp.location}
                            </div>
                            <div className="flex items-center text-primary font-medium">
                              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              {exp.period}
                            </div>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                          <p 
                            className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4"
                            style={{ wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none' }}
                          >{exp.description}</p>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {exp.achievements.map((achievement, achievementIndex) => (
                              <span
                                key={achievementIndex}
                                className="max-w-full px-2 py-0.5 sm:py-1 bg-primary/10 text-primary rounded text-xs whitespace-normal break-normal leading-snug"
                              >
                                {achievement}
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
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
