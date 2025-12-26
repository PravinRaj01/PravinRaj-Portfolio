import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Filter, ExternalLink, Github, Calendar, Tag, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useProjects } from '@/hooks/useProjects';
import { generateDriveImageUrl } from '@/utils/googleDrive';

const Projects = () => {
  const { mode, darkMode } = usePortfolio();
  const { projects, loading } = useProjects(mode);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'timeline' | 'cards'>('timeline');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [currentIndex, setCurrentIndex] = useState(0);
  const timelineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Get unique categories from projects
  const categories = ['all', ...new Set(projects.map(project => project.category))];

  const filteredProjects = selectedFilter === 'all' 
    ? projects 
    : projects.filter(project => project.category === selectedFilter);

  // Sort projects based on order
  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects];
    if (sortOrder === 'oldest') {
      return sorted.reverse();
    }
    return sorted;
  }, [filteredProjects, sortOrder]);

  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    const newIndex = direction === 'up' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(sortedProjects.length - 1, currentIndex + 1);
    
    setCurrentIndex(newIndex);
    timelineRefs.current[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentIndex, sortedProjects.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <CursorFollower />
        <RadialGradient 
          scale="scale-y-100" 
          opacity={darkMode ? "opacity-30" : "opacity-30"} 
        />
        <Navigation />
        <div className="pt-16 sm:pt-20 px-3 sm:px-4">
          <div className="container mx-auto py-8 sm:py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading projects...</p>
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
                : 'from-blue-600 to-blue-700'
            } bg-clip-text text-transparent`}>
              {mode === 'professional' ? 'Development Projects' : 'Creative Portfolio'}
            </h1>
            <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
              {mode === 'professional' 
                ? 'A showcase of my technical projects and development work'
                : 'A collection of my creative work in design and video production'
              }
            </p>

            {/* Filters & View Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8">
              {/* View Mode Toggle */}
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

              {/* Sort Order */}
              <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest') => setSortOrder(value)}>
                <SelectTrigger className="w-[110px] sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                  <ArrowUpDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              {categories.length > 1 && (
                <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                  <SelectTrigger className="w-[110px] sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                    <Filter className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category} className="capitalize">
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </motion.div>

          {sortedProjects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No projects found for {mode} mode.</p>
            </div>
          ) : (
            <>
              {/* Timeline View */}
              {viewMode === 'timeline' && (
                <div className="relative">
                  <div className="absolute left-3 sm:left-4 md:left-8 top-0 bottom-0 w-0.5 bg-border"></div>
                  <div className="space-y-4 sm:space-y-8 md:space-y-12">
                    {sortedProjects.map((project, index) => (
                      <motion.div
                        key={project.id}
                        ref={(el) => { timelineRefs.current[index] = el; }}
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                        viewport={{ once: true }}
                        className="relative pl-8 sm:pl-10 md:pl-16"
                        onViewportEnter={() => setCurrentIndex(index)}
                      >
                        <div className={`absolute left-1 sm:left-2 md:left-6 w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 sm:border-4 border-background transition-colors ${
                          currentIndex === index ? 'bg-primary scale-125' : 'bg-primary/60'
                        }`}></div>
                        <Card className="hover:shadow-lg transition-shadow overflow-hidden">
                          <div className="flex flex-col md:flex-row">
                            {/* Project Image */}
                            <div className="relative w-full md:w-1/3 h-36 sm:h-48 md:h-auto overflow-hidden">
                              {project.image_drive_id ? (
                                <img 
                                  src={generateDriveImageUrl(project.image_drive_id, 'medium')} 
                                  alt={project.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center min-h-[140px] sm:min-h-[200px]">
                                  <span className="text-muted-foreground text-xs sm:text-sm">No Image</span>
                                </div>
                              )}
                              {project.featured && (
                                <Badge className={`absolute top-2 left-2 sm:top-3 sm:left-3 text-[10px] sm:text-xs bg-gradient-to-r ${
                                  mode === 'creative' 
                                    ? 'from-orange-500 to-orange-600' 
                                    : 'from-blue-600 to-purple-600'
                                } text-white`}>
                                  Featured
                                </Badge>
                              )}
                            </div>

                            {/* Project Content */}
                            <div className="w-full md:w-2/3">
                              <CardHeader className="p-3 sm:p-4 md:p-6">
                                <div className="flex flex-col gap-1 sm:gap-2">
                                  <CardTitle className="text-base sm:text-lg md:text-xl">{project.title}</CardTitle>
                                  <CardDescription className="flex items-center text-xs sm:text-sm md:text-base">
                                    <Tag className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                    {project.category}
                                  </CardDescription>
                                </div>
                              </CardHeader>
                              <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                                <p 
                                  className="text-xs sm:text-sm md:text-base text-muted-foreground mb-3 sm:mb-4 line-clamp-2 sm:line-clamp-3"
                                  style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', hyphens: 'none' }}
                                >{project.description}</p>
                                
                                {/* Tags */}
                                <div className="flex flex-wrap gap-1 sm:gap-2 mb-3 sm:mb-4">
                                  {project.tags.slice(0, 3).map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="secondary"
                                      className="text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                  {project.tags.length > 3 && (
                                    <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1">
                                      +{project.tags.length - 3}
                                    </Badge>
                                  )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                  {project.live_url && (
                                    <Button size="sm" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3" asChild>
                                      <a href={project.live_url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                        {mode === 'professional' ? 'Demo' : 'View'}
                                      </a>
                                    </Button>
                                  )}
                                  {project.github_url && (
                                    <Button size="sm" variant="outline" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3" asChild>
                                      <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                                        <Github className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                        Code
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cards View */}
              {viewMode === 'cards' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                  {sortedProjects.map((project, index) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden">
                        {/* Project Image */}
                        <div className="relative h-32 sm:h-40 md:h-48 overflow-hidden">
                          {project.image_drive_id ? (
                            <img 
                              src={generateDriveImageUrl(project.image_drive_id, 'medium')} 
                              alt={project.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                              <span className="text-muted-foreground text-xs sm:text-sm">No Image</span>
                            </div>
                          )}
                          {project.featured && (
                            <Badge className={`absolute top-2 left-2 sm:top-3 sm:left-3 text-[10px] sm:text-xs bg-gradient-to-r ${
                              mode === 'creative' 
                                ? 'from-orange-500 to-orange-600' 
                                : 'from-blue-600 to-purple-600'
                            } text-white`}>
                              Featured
                            </Badge>
                          )}
                        </div>

                        <CardHeader className="p-3 sm:p-4 md:p-6">
                          <CardTitle className="text-sm sm:text-base md:text-lg">{project.title}</CardTitle>
                          <CardDescription className="text-xs sm:text-sm">
                            <div className="flex items-center">
                              <Tag className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              {project.category}
                            </div>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                          <p 
                            className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2"
                            style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', hyphens: 'none' }}
                          >{project.description}</p>
                          
                          {/* Tags */}
                          <div className="flex flex-wrap gap-1 mb-3 sm:mb-4">
                            {project.tags.slice(0, 2).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-[10px] sm:text-xs px-1.5 py-0.5"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {project.tags.length > 2 && (
                              <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0.5">
                                +{project.tags.length - 2}
                              </Badge>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            {project.live_url && (
                              <Button size="sm" className="flex-1 h-7 sm:h-8 text-xs sm:text-sm" asChild>
                                <a href={project.live_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                  {mode === 'professional' ? 'Live' : 'View'}
                                </a>
                              </Button>
                            )}
                            {project.github_url && (
                              <Button size="sm" variant="outline" className="flex-1 h-7 sm:h-8 text-xs sm:text-sm" asChild>
                                <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                                  <Github className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                  Code
                                </a>
                              </Button>
                            )}
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

export default Projects;
