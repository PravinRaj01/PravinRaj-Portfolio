import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, ExternalLink, Github, Calendar, Tag, ArrowUpDown, Star, Folder, Search, ZoomIn, ZoomOut, User, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import FolderCard from '@/components/FolderCard';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useProjects } from '@/hooks/useProjects';
import { useProjectFolders } from '@/hooks/useProjectFolders';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { parse } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { usePageMeta } from '@/hooks/usePageMeta';
import { getModePath } from '@/lib/modePath';
import { projectsListMeta } from '@/lib/seo';

const Projects = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { mode, defaultMode, darkMode } = usePortfolio();

  const { projects, loading } = useProjects(mode);
  usePageMeta(projectsListMeta(mode, defaultMode, projects));
  const { folders, loading: foldersLoading } = useProjectFolders(mode);
  const { data: siteSettings } = useSiteSettings();
  
  // Initialize from URL params, fallback to localStorage
  const [selectedFilter, setSelectedFilter] = useState(() => {
    return searchParams.get('category') || localStorage.getItem('projects-category-filter') || 'all';
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    return searchParams.get('search') || localStorage.getItem('projects-search-query') || '';
  });
  const [viewMode, setViewMode] = useState<'timeline' | 'cards'>(() => {
    const urlView = searchParams.get('view') as 'timeline' | 'cards' | null;
    if (urlView) return urlView;
    const saved = localStorage.getItem('projects-view-mode');
    return (saved as 'timeline' | 'cards') || 'cards';
  });
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>(() => {
    return (searchParams.get('sort') as 'newest' | 'oldest') || 'newest';
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const timelineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isMobile = useIsMobile();
  
  // Sync state to URL params and localStorage
  useEffect(() => {
    localStorage.setItem('projects-category-filter', selectedFilter);
    localStorage.setItem('projects-search-query', searchQuery);
    localStorage.setItem('projects-view-mode', viewMode);
    
    const params: Record<string, string> = {};
    if (selectedFilter !== 'all') params.category = selectedFilter;
    if (searchQuery.trim()) params.search = searchQuery;
    if (viewMode !== 'cards') params.view = viewMode;
    if (sortOrder !== 'newest') params.sort = sortOrder;
    
    setSearchParams(params, { replace: true });
  }, [selectedFilter, searchQuery, viewMode, sortOrder, setSearchParams]);
  
  // Zoom state - load from localStorage
  const [cardZoom, setCardZoom] = useState(() => {
    const saved = localStorage.getItem('projects-card-zoom');
    return saved ? parseInt(saved, 10) : 100;
  });

  // Save zoom to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('projects-card-zoom', String(cardZoom));
  }, [cardZoom]);

  // (viewMode is now synced in the combined effect above)

  // Set default view from settings ONLY if no user preference exists
  useEffect(() => {
    const hasUserPreference = localStorage.getItem('projects-view-mode');
    if (!hasUserPreference && siteSettings?.projects_default_view) {
      setViewMode(siteSettings.projects_default_view);
    }
  }, [siteSettings?.projects_default_view]);

  // Get unique categories from projects
  // Get unique categories from projects - include both category and categories array
  const categories = ['all', ...new Set(
    projects.flatMap(project => 
      project.categories?.length 
        ? project.categories 
        : [project.category]
    ).filter(Boolean)
  )];

  // Separate projects: standalone (no folder) OR featured projects (shown outside folder too)
  const standaloneProjects = projects.filter(p => !p.folder_id || p.featured);
  // Apply search and category filter to projects
  const searchFilteredProjects = useMemo(() => {
    let filtered = projects;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project => 
        project.title.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        project.tags.some(tag => tag.toLowerCase().includes(query)) ||
        project.category.toLowerCase().includes(query)
      );
    }
    
    // Apply category filter - check both category and categories array
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(project => {
        const projectCategories = project.categories?.length 
          ? project.categories 
          : [project.category];
        return projectCategories.includes(selectedFilter);
      });
    }
    
    // Sort: featured first, then by order_index
    return filtered.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return 0;
    });
  }, [projects, searchQuery, selectedFilter]);

  // Filter folders based on whether they contain projects matching current filter
  const foldersWithProjects = useMemo(() => {
    return folders.filter(f => {
      // Must have projects
      if (!f.project_count || f.project_count === 0) return false;
      
      // If no filter applied, show all folders with projects
      if (selectedFilter === 'all' && !searchQuery.trim()) return true;
      
      // Check if any projects in this folder match the current filter/search
      const folderProjects = projects.filter(p => p.folder_id === f.id);
      return folderProjects.some(project => {
        const matchesCategory = selectedFilter === 'all' || project.category === selectedFilter;
        const matchesSearch = !searchQuery.trim() || 
          project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
      });
    });
  }, [folders, projects, selectedFilter, searchQuery]);

  const filteredProjects = searchFilteredProjects;

  // Standalone = no folder OR featured (show featured outside folders too)
  // Sort: featured first
  const filteredStandaloneProjects = searchFilteredProjects
    .filter(p => !p.folder_id || p.featured)
    .sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return 0;
    });

  // Helper function to parse project date
  const parseProjectDate = (dateStr?: string): Date => {
    if (!dateStr) return new Date(0); // Return epoch if no date
    try {
      // Try parsing different formats
      let date = parse(dateStr, "d MMM yyyy", new Date());
      if (isNaN(date.getTime())) {
        date = parse(dateStr, "MMM yyyy", new Date());
      }
      if (isNaN(date.getTime())) {
        date = parse(dateStr, "yyyy", new Date());
      }
      return isNaN(date.getTime()) ? new Date(0) : date;
    } catch {
      return new Date(0);
    }
  };

  // Sort projects: featured first in cards view, then by date
  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects].sort((a, b) => {
      // In cards view, featured items come first
      if (viewMode === 'cards') {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
      }
      
      const dateA = parseProjectDate(a.project_date);
      const dateB = parseProjectDate(b.project_date);
      
      if (sortOrder === 'newest') {
        return dateB.getTime() - dateA.getTime();
      } else {
        return dateA.getTime() - dateB.getTime();
      }
    });
    return sorted;
  }, [filteredProjects, sortOrder, viewMode]);

  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    const newIndex = direction === 'up' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(sortedProjects.length - 1, currentIndex + 1);
    
    setCurrentIndex(newIndex);
    timelineRefs.current[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentIndex, sortedProjects.length]);

  // Loading state includes folders
  const isLoading = loading || foldersLoading;

  if (isLoading) {
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
            <h1 className={`text-2xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 pb-2 bg-gradient-to-r ${
              mode === 'creative' 
                ? 'from-orange-500 to-orange-600' 
                : 'from-blue-600 to-purple-600'
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
                <div className="flex items-center gap-1">
                  <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                    <SelectTrigger className={cn(
                      "w-[110px] sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm",
                      selectedFilter !== 'all' && (mode === 'creative' ? 'border-orange-500/50' : 'border-purple-500/50')
                    )}>
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
                  {selectedFilter !== 'all' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedFilter('all')}
                      title="Clear filter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              )}

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-[120px] sm:w-[160px] h-8 sm:h-9 text-xs sm:text-sm pl-8 pr-7",
                    searchQuery && (mode === 'creative' ? 'border-orange-500/50' : 'border-purple-500/50')
                  )}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {/* Zoom Controls */}
              {viewMode === 'cards' && (
                <div className="flex items-center gap-2">
                  {isMobile ? (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCardZoom(prev => Math.max(60, prev - 10))}
                        disabled={cardZoom <= 60}
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </Button>
                      <span className="text-xs text-muted-foreground w-8 text-center">{cardZoom}%</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCardZoom(prev => Math.min(120, prev + 10))}
                        disabled={cardZoom >= 120}
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-2 py-1">
                      <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
                      <Slider
                        value={[cardZoom]}
                        onValueChange={(values) => setCardZoom(values[0])}
                        min={60}
                        max={120}
                        step={5}
                        className="w-24"
                      />
                      <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
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
                        <Card 
                          className="hover:shadow-lg transition-shadow overflow-hidden cursor-pointer"
                          onClick={() => navigate(getModePath(mode, defaultMode, `/projects/${project.slug || project.id}`))}
                        >
                          <div className="flex flex-col md:flex-row">
                            {/* Project Image - Square Crop */}
                            <div className="relative w-full md:w-48 aspect-square md:aspect-square overflow-hidden flex-shrink-0">
                              {project.image_drive_id ? (
                                <img 
                                  src={project.image_drive_id.startsWith('http') 
                                    ? project.image_drive_id 
                                    : generateDriveImageUrl(project.image_drive_id, 'medium')} 
                                  alt={project.title}
                                  className="w-full h-full object-cover"
                                  style={{
                                    objectPosition: `${project.crop_square?.x ?? 50}% ${project.crop_square?.y ?? 50}%`,
                                    transform: `scale(${(project.crop_square?.zoom ?? 100) / 100})`,
                                    transformOrigin: `${project.crop_square?.x ?? 50}% ${project.crop_square?.y ?? 50}%`
                                  }}
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

                            {/* Project Content */}
                            <div className="w-full md:w-2/3">
                              <CardHeader className="p-3 sm:p-4 md:p-6">
                                <div className="flex flex-col gap-1 sm:gap-2">
                                  {/* Position Badges for Creative Mode */}
                                  {mode === 'creative' && (project.positions?.length ? project.positions : project.position ? [project.position] : []).length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {(project.positions?.length ? project.positions : project.position ? [project.position] : []).map((pos, idx) => (
                                        <Badge key={idx} className="text-[10px] sm:text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                                          {pos}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  <CardTitle className="text-base sm:text-lg md:text-xl">{project.title}</CardTitle>
                                  <CardDescription className="flex items-center gap-2 text-xs sm:text-sm md:text-base flex-wrap">
                                    <span className="flex items-center">
                                      <Tag className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                      {project.category}
                                    </span>
                                    {project.project_date && (
                                      <span className="flex items-center text-muted-foreground">
                                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                        {project.project_date}
                                      </span>
                                    )}
                                    {/* Folder badge in timeline view */}
                                    {project.folder_id && folders.find(f => f.id === project.folder_id) && (
                                      <span 
                                        className={`flex items-center cursor-pointer ${
                                          mode === 'creative' ? 'text-orange-400' : 'text-purple-400'
                                        }`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(getModePath(mode, defaultMode, `/projects/folder/${project.folder_id}`));
                                        }}
                                      >
                                        <Folder className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                        {folders.find(f => f.id === project.folder_id)?.name}
                                      </span>
                                    )}
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
                                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                                  {project.live_url && (
                                    <Button size="sm" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3" asChild>
                                      <a href={project.live_url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                        <span className="truncate">{mode === 'professional' ? 'Demo' : 'View'}</span>
                                      </a>
                                    </Button>
                                  )}
                                  {project.github_url && (
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${
                                        mode === 'creative' 
                                          ? 'border-orange-400/50 text-orange-400/80 hover:bg-orange-500/5 hover:text-orange-400' 
                                          : 'border-purple-400/50 text-purple-400/80 hover:bg-purple-500/5 hover:text-purple-400'
                                      }`} 
                                      asChild
                                    >
                                      <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                                        <Github className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                        <span className="truncate">Code</span>
                                      </a>
                                    </Button>
                                  )}
                                  {/* Custom links with show_on_card */}
                                  {project.project_links?.filter(link => link.show_on_card).map((link, idx) => (
                                    <Button 
                                      key={idx}
                                      size="sm" 
                                      variant="outline" 
                                      className={`h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 ${
                                        mode === 'creative' 
                                          ? 'border-orange-400/50 text-orange-400/80 hover:bg-orange-500/5 hover:text-orange-400' 
                                          : 'border-purple-400/50 text-purple-400/80 hover:bg-purple-500/5 hover:text-purple-400'
                                      }`}
                                      asChild
                                    >
                                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                        <span className="truncate">{link.label}</span>
                                      </a>
                                    </Button>
                                  ))}
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

              {/* Cards View - Shows folders + standalone projects */}
              {viewMode === 'cards' && (
                <div className="pb-12">
                  {/* Folders Button/Dialog - Only show if there are folders */}
                  {foldersWithProjects.length > 0 && (
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowFolderPicker(true)}
                          className={cn(
                            "gap-2 w-full sm:w-auto",
                            mode === 'creative' 
                              ? 'border-orange-500/50 hover:border-orange-500 hover:bg-orange-500/10' 
                              : 'border-purple-500/50 hover:border-purple-500 hover:bg-purple-500/10'
                          )}
                        >
                          <Folder className={cn(
                            "w-4 h-4",
                            mode === 'creative' ? 'text-orange-400' : 'text-purple-400'
                          )} />
                          <span>Browse Folders</span>
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "ml-1 text-xs",
                              mode === 'creative' ? 'bg-orange-500/20 text-orange-400' : 'bg-purple-500/20 text-purple-400'
                            )}
                          >
                            {foldersWithProjects.length}
                          </Badge>
                        </Button>
                        
                        {/* Desktop/Tablet indicator */}
                        {!isMobile && (
                          <span className="hidden sm:flex items-center text-sm text-muted-foreground">
                            <span className="mx-2">|</span>
                            Showing featured & unfoldered projects
                          </span>
                        )}
                      </div>
                      
                      {/* Mobile indicator */}
                      {isMobile && (
                        <span className="text-xs text-muted-foreground">
                          No folder selected
                        </span>
                      )}
                      
                      <Dialog open={showFolderPicker} onOpenChange={setShowFolderPicker}>
                        <DialogContent className="w-[90vw] max-w-[500px] max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Project Folders</DialogTitle>
                          </DialogHeader>
                          
                          {isMobile ? (
                            /* Mobile: List view */
                            <div className="flex flex-col gap-2">
                              {foldersWithProjects.map((folder) => (
                                <button
                                  key={folder.id}
                                  onClick={() => {
                                    navigate(getModePath(mode, defaultMode, `/projects/folder/${folder.id}`));
                                    setShowFolderPicker(false);
                                  }}
                                  className={cn(
                                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                    mode === 'creative' 
                                      ? 'border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/10' 
                                      : 'border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/10'
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Folder className={cn(
                                      "w-4 h-4",
                                      mode === 'creative' ? 'text-orange-400' : 'text-purple-400'
                                    )} />
                                    <span className="text-sm">{folder.name}</span>
                                  </div>
                                  <Badge variant="secondary" className="text-xs">
                                    {folder.project_count}
                                  </Badge>
                                </button>
                              ))}
                            </div>
                          ) : (
                            /* Desktop: Grid view */
                            <div className="grid grid-cols-2 gap-2">
                              {foldersWithProjects.map((folder) => (
                                <button
                                  key={folder.id}
                                  onClick={() => {
                                    navigate(getModePath(mode, defaultMode, `/projects/folder/${folder.id}`));
                                    setShowFolderPicker(false);
                                  }}
                                  className={cn(
                                    "group relative aspect-video rounded-lg overflow-hidden border-2 transition-all hover:scale-[1.02]",
                                    mode === 'creative' 
                                      ? 'border-orange-500/30 hover:border-orange-500/60' 
                                      : 'border-purple-500/30 hover:border-purple-500/60',
                                    "bg-card/50"
                                  )}
                                >
                                  {folder.cover_image_drive_id ? (
                                    <img
                                      src={folder.cover_image_drive_id.startsWith('http') 
                                        ? folder.cover_image_drive_id 
                                        : generateDriveImageUrl(folder.cover_image_drive_id, 'small')}
                                      alt={folder.name}
                                      className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                                    />
                                  ) : (
                                    <div className={cn(
                                      "w-full h-full flex items-center justify-center",
                                      mode === 'creative' 
                                        ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/10' 
                                        : 'bg-gradient-to-br from-purple-500/20 to-purple-600/10'
                                    )}>
                                      <Folder className={cn(
                                        "w-8 h-8",
                                        mode === 'creative' ? 'text-orange-400' : 'text-purple-400'
                                      )} />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2">
                                    <span className="text-white text-xs font-medium truncate">{folder.name}</span>
                                    <span className="text-white/70 text-[10px]">{folder.project_count} project{folder.project_count !== 1 ? 's' : ''}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                  
                  {/* Projects Grid */}
                  <div className={`grid gap-3 sm:gap-4 md:gap-5 ${
                    cardZoom <= 70 ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' :
                    cardZoom <= 85 ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' :
                    cardZoom <= 105 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' :
                    'grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3'
                  }`}>
                  {/* Render Standalone Projects + Featured Folder Projects (sorted) */}
                  {sortedProjects.filter(p => !p.folder_id || p.featured).map((project, index) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <Card 
                        className="h-full hover:shadow-lg transition-shadow overflow-hidden cursor-pointer flex flex-col"
                        onClick={() => navigate(getModePath(mode, defaultMode, `/projects/${project.slug || project.id}`))}
                      >
                        {/* Project Image - 16:9 Ratio */}
                        <div className="relative aspect-video overflow-hidden flex-shrink-0">
                          {project.image_drive_id ? (
                            <img 
                              src={project.image_drive_id.startsWith('http') 
                                ? project.image_drive_id 
                                : generateDriveImageUrl(project.image_drive_id, 'medium')} 
                              alt={project.title}
                              className="w-full h-full object-cover"
                              style={{
                                objectPosition: `${project.crop_landscape?.x ?? 50}% ${project.crop_landscape?.y ?? 50}%`,
                                transform: `scale(${(project.crop_landscape?.zoom ?? 100) / 100})`,
                                transformOrigin: `${project.crop_landscape?.x ?? 50}% ${project.crop_landscape?.y ?? 50}%`
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                              <span className="text-muted-foreground text-xs sm:text-sm">No Image</span>
                            </div>
                          )}
                          {/* Featured badge */}
                          {project.featured && (
                            <Badge className={`absolute top-2 left-2 sm:top-3 sm:left-3 text-[10px] sm:text-xs bg-gradient-to-r ${
                              mode === 'creative' 
                                ? 'from-orange-500 to-orange-600' 
                                : 'from-blue-600 to-purple-600'
                            } text-white`}>
                              Featured
                            </Badge>
                          )}
                          {/* Folder indicator for featured folder projects */}
                          {project.folder_id && project.featured && (
                            <Badge 
                              className={`absolute top-2 right-2 sm:top-3 sm:right-3 text-[10px] sm:text-xs ${
                                mode === 'creative' 
                                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' 
                                  : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(getModePath(mode, defaultMode, `/projects/folder/${project.folder_id}`));
                              }}
                            >
                              <Folder className="w-3 h-3 mr-1" />
                              In Folder
                            </Badge>
                          )}
                        </div>

                        <CardHeader className="p-3 sm:p-4 md:p-6 flex-shrink-0">
                          {/* Position Badges for Creative Mode */}
                          {mode === 'creative' && (project.positions?.length ? project.positions : project.position ? [project.position] : []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {(project.positions?.length ? project.positions : project.position ? [project.position] : []).map((pos, idx) => (
                                <Badge key={idx} className="text-[10px] sm:text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                                  {pos}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <CardTitle className="text-sm sm:text-base md:text-lg">{project.title}</CardTitle>
                          <CardDescription className="text-xs sm:text-sm">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="flex items-center">
                                <Tag className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                {project.category}
                              </span>
                              {project.project_date && (
                                <span className="flex items-center text-muted-foreground">
                                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                  {project.project_date}
                                </span>
                              )}
                            </div>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 pt-0 flex flex-col flex-1">
                          <div 
                            className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2 prose-sm prose-p:my-0"
                            style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', hyphens: 'none' }}
                          >
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <span>{children}</span>,
                                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                em: ({ children }) => <em>{children}</em>,
                              }}
                            >
                              {project.description}
                            </ReactMarkdown>
                          </div>
                          
                          
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

                          {/* Spacer to push buttons to bottom */}
                          <div className="flex-grow" />

                          {/* Action Buttons */}
                          <div className="flex flex-wrap gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
                            {project.live_url && (
                              <Button size="sm" className="flex-1 min-w-0 h-7 sm:h-8 text-xs sm:text-sm" asChild>
                                <a href={project.live_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                  <span className="truncate">{mode === 'professional' ? 'Live' : 'View'}</span>
                                </a>
                              </Button>
                            )}
                            {project.github_url && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className={`flex-1 min-w-0 h-7 sm:h-8 text-xs sm:text-sm ${
                                  mode === 'creative' 
                                    ? 'border-orange-400/50 text-orange-400/80 hover:bg-orange-500/5 hover:text-orange-400' 
                                    : 'border-purple-400/50 text-purple-400/80 hover:bg-purple-500/5 hover:text-purple-400'
                                }`} 
                                asChild
                              >
                                <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                                  <Github className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                  <span className="truncate">Code</span>
                                </a>
                              </Button>
                            )}
                            {/* Custom links with show_on_card */}
                            {project.project_links?.filter(link => link.show_on_card).map((link, idx) => (
                              <Button 
                                key={idx}
                                size="sm" 
                                variant="outline" 
                                className={`flex-1 min-w-0 h-7 sm:h-8 text-xs sm:text-sm ${
                                  mode === 'creative' 
                                    ? 'border-orange-400/50 text-orange-400/80 hover:bg-orange-500/5 hover:text-orange-400' 
                                    : 'border-purple-400/50 text-purple-400/80 hover:bg-purple-500/5 hover:text-purple-400'
                                }`}
                                asChild
                              >
                                <a href={link.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                  <span className="truncate">{link.label}</span>
                                </a>
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                  </div>
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
