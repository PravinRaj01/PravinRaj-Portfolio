import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Award, Calendar, MapPin, ArrowUpDown, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import { useEducation } from '@/hooks/useEducation';
import { useCertifications } from '@/hooks/useCertifications';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { parse } from 'date-fns';

// Parse date from various formats
const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(0);
  
  // For period strings like "Aug 2021 - Dec 2025", extract start date
  const startPart = dateStr.split(' - ')[0].trim();
  
  // Try full date format first (e.g., "15 Aug 2021")
  let date = parse(startPart, "d MMM yyyy", new Date());
  if (!isNaN(date.getTime())) return date;
  
  // Try month-year format (e.g., "Aug 2021")
  date = parse(startPart, "MMM yyyy", new Date());
  if (!isNaN(date.getTime())) return date;
  
  // Try year only
  date = parse(startPart, "yyyy", new Date());
  if (!isNaN(date.getTime())) return date;
  
  return new Date(0);
};

const Academic = () => {
  const { mode, darkMode } = usePortfolio();
  const { data: education = [], isLoading: educationLoading } = useEducation();
  const { data: certifications = [], isLoading: certificationsLoading } = useCertifications();
  const [viewMode, setViewMode] = useState<'timeline' | 'cards'>('timeline');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [currentIndex, setCurrentIndex] = useState(0);
  const timelineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Sort education based on period dates
  const sortedEducation = useMemo(() => {
    const sorted = [...education].sort((a, b) => {
      const dateA = parseDate(a.period);
      const dateB = parseDate(b.period);
      return sortOrder === 'newest' 
        ? dateB.getTime() - dateA.getTime() 
        : dateA.getTime() - dateB.getTime();
    });
    return sorted;
  }, [education, sortOrder]);

  // Sort certifications based on date
  const sortedCertifications = useMemo(() => {
    const sorted = [...certifications].sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      return sortOrder === 'newest' 
        ? dateB.getTime() - dateA.getTime() 
        : dateA.getTime() - dateB.getTime();
    });
    return sorted;
  }, [certifications, sortOrder]);

  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    const newIndex = direction === 'up' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(sortedEducation.length - 1, currentIndex + 1);
    
    setCurrentIndex(newIndex);
    timelineRefs.current[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentIndex, sortedEducation.length]);

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
              Academic Background
            </h1>
            <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
              My educational journey, professional certifications, and achievements that have shaped my expertise
            </p>

            {/* View Mode Toggle & Sort */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
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

          {/* Education Section */}
          <section className="mb-12 sm:mb-20">
            <motion.h2
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8 flex items-center"
            >
              <GraduationCap className="mr-2 sm:mr-3 w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-primary" />
              Education
            </motion.h2>

            {educationLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading education...</p>
              </div>
            ) : sortedEducation.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No education entries found.</p>
              </div>
            ) : viewMode === 'timeline' ? (
              <div className="relative">
                <div className="absolute left-3 sm:left-4 md:left-8 top-0 bottom-0 w-0.5 bg-border"></div>
                <div className="space-y-4 sm:space-y-6 md:space-y-8">
                  {sortedEducation.map((edu, index) => (
                    <motion.div
                      key={edu.id}
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
                              <CardTitle className="text-base sm:text-lg md:text-xl mb-1 sm:mb-2">{edu.degree}</CardTitle>
                              <CardDescription className="flex flex-wrap items-center gap-1 text-xs sm:text-sm md:text-base">
                                <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="break-normal">{edu.institution}, {edu.location}</span>
                              </CardDescription>
                            </div>
                            <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              {edu.period}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-3 sm:mb-4">{edu.description}</p>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {edu.achievements.map((achievement, achIndex) => (
                              <span
                                key={achIndex}
                                className="px-2 py-0.5 sm:px-3 sm:py-1 bg-primary/10 text-primary rounded-full text-[10px] sm:text-xs md:text-sm"
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
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                {sortedEducation.map((edu, index) => (
                  <motion.div
                    key={edu.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <Card className="h-full hover:shadow-lg transition-shadow">
                      <CardHeader className="p-3 sm:p-4 md:p-6">
                        <CardTitle className="text-sm sm:text-base md:text-lg">{edu.degree}</CardTitle>
                        <CardDescription className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm">
                          <div className="flex items-center">
                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                            <span className="break-normal">{edu.institution}, {edu.location}</span>
                          </div>
                          <div className="flex items-center text-primary font-medium">
                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            {edu.period}
                          </div>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">{edu.description}</p>
                        <div className="flex flex-wrap gap-1 sm:gap-2">
                          {edu.achievements.map((achievement, achIndex) => (
                            <span
                              key={achIndex}
                              className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-primary/10 text-primary rounded text-[10px] sm:text-xs"
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
          </section>

          {/* Certifications Section */}
          <section>
            <motion.h2
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8 flex items-center"
            >
              <Award className="mr-2 sm:mr-3 w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-primary" />
              Certifications & Achievements
            </motion.h2>

            {certificationsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading certifications & achievements...</p>
              </div>
            ) : sortedCertifications.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No certifications or achievements found.</p>
              </div>
            ) : viewMode === 'timeline' ? (
              <div className="relative">
                <div className="absolute left-3 sm:left-4 md:left-8 top-0 bottom-0 w-0.5 bg-border"></div>
                <div className="space-y-4 sm:space-y-6 md:space-y-8">
                  {sortedCertifications.map((cert, index) => (
                    <motion.div
                      key={cert.id}
                      initial={{ opacity: 0, x: -30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, delay: index * 0.2 }}
                      viewport={{ once: true }}
                      className="relative pl-8 sm:pl-10 md:pl-16"
                    >
                      <div className="absolute left-1 sm:left-2 md:left-6 w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 sm:border-4 border-background bg-primary/60"></div>
                      <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="p-3 sm:p-4 md:p-6">
                          <div className="flex flex-col gap-2">
                            <div>
                              <CardTitle className="text-base sm:text-lg md:text-xl mb-1 sm:mb-2">{cert.name}</CardTitle>
                              <CardDescription className="text-xs sm:text-sm md:text-base">
                                {cert.issuer}
                              </CardDescription>
                            </div>
                            <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              {cert.date}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-2 sm:mb-3">{cert.description}</p>
                          {cert.credential_id && (
                            <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground break-normal mb-2">
                              <strong>Credential ID:</strong> {cert.credential_id}
                            </p>
                          )}
                          {cert.credential_url && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-2 text-xs"
                              onClick={() => window.open(cert.credential_url, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              View Credential
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                {sortedCertifications.map((cert, index) => (
                  <motion.div
                    key={cert.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <Card className="h-full hover:shadow-lg transition-shadow">
                      <CardHeader className="p-3 sm:p-4 md:p-6">
                        <CardTitle className="text-sm sm:text-base md:text-lg">{cert.name}</CardTitle>
                        <CardDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs sm:text-sm">
                          <span>{cert.issuer}</span>
                          <span className="text-primary font-medium">{cert.date}</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">{cert.description}</p>
                        {cert.credential_id && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground break-normal mb-2">
                            <strong>Credential ID:</strong> {cert.credential_id}
                          </p>
                        )}
                        {cert.credential_url && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2 text-xs"
                            onClick={() => window.open(cert.credential_url, '_blank')}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View Credential
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Academic;
