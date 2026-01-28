import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Grid, List, Folder, ExternalLink, Github, Calendar, Tag, Filter, ArrowUpDown, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import Footer from '@/components/Footer';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useProjects } from '@/hooks/useProjects';
import { useProjectFolders, ProjectFolder as FolderType } from '@/hooks/useProjectFolders';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { Project } from '@/types/cms';
import { parse } from 'date-fns';
import ReactMarkdown from 'react-markdown';

const ProjectFolderPage = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { mode, darkMode } = usePortfolio();
  const { projects, loading: projectsLoading } = useProjects(mode);
  const { folders, loading: foldersLoading } = useProjectFolders(mode);
  const { data: siteSettings } = useSiteSettings();
  
  const [folder, setFolder] = useState<FolderType | null>(null);
  const [folderProjects, setFolderProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>('cards');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Set default view from settings
  useEffect(() => {
    if (siteSettings?.projects_default_view) {
      setViewMode(siteSettings.projects_default_view as 'cards' | 'timeline');
    }
  }, [siteSettings]);

  // Find folder and filter projects
  useEffect(() => {
    if (!foldersLoading && folderId) {
      const foundFolder = folders.find(f => f.id === folderId);
      setFolder(foundFolder || null);
    }
  }, [folders, folderId, foldersLoading]);

  useEffect(() => {
    if (!projectsLoading && folderId) {
      const filtered = projects.filter(p => p.folder_id === folderId);
      setFolderProjects(filtered);
    }
  }, [projects, folderId, projectsLoading]);

  // Get unique categories from folder projects
  const categories = ['all', ...Array.from(new Set(folderProjects.map(p => p.category)))];
  
  // Helper function to parse project date
  const parseProjectDate = (dateStr?: string): Date => {
    if (!dateStr) return new Date(0);
    try {
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

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = folderProjects;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project => 
        project.title.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        project.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter
    if (activeCategory !== 'all') {
      filtered = filtered.filter(p => p.category === activeCategory);
    }
    
    // Sort: featured first, then by date
    filtered = [...filtered].sort((a, b) => {
      // Featured always comes first
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      
      // Then sort by date
      const dateA = parseProjectDate(a.project_date);
      const dateB = parseProjectDate(b.project_date);
      return sortOrder === 'newest' 
        ? dateB.getTime() - dateA.getTime()
        : dateA.getTime() - dateB.getTime();
    });
    
    return filtered;
  }, [folderProjects, searchQuery, activeCategory, sortOrder]);

  const loading = projectsLoading || foldersLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <CursorFollower />
        <RadialGradient scale="scale-y-100" opacity={darkMode ? "opacity-30" : "opacity-30"} />
        <Navigation />
        <div className="pt-24 px-4">
          <div className="container mx-auto py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading folder...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="min-h-screen bg-background">
        <CursorFollower />
        <RadialGradient scale="scale-y-100" opacity={darkMode ? "opacity-30" : "opacity-30"} />
        <Navigation />
        <div className="pt-24 px-4">
          <div className="container mx-auto py-12 text-center">
            <Folder className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">Folder Not Found</h1>
            <p className="text-muted-foreground mb-6">The folder you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/projects')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const accentColor = mode === 'creative' ? 'text-orange-400' : 'text-purple-400';
  const accentBg = mode === 'creative' ? 'bg-orange-500/20 border-orange-500/30' : 'bg-purple-500/20 border-purple-500/30';

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <CursorFollower />
      <RadialGradient scale="scale-y-100" opacity={darkMode ? "opacity-30" : "opacity-30"} />
      <Navigation />

      <main className="flex-1 pt-20 sm:pt-24 px-4">
        <div className="container mx-auto max-w-7xl py-8">
          {/* Breadcrumb & Back */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6"
          >
            <Button 
              variant="ghost" 
              onClick={() => navigate('/projects')}
              className="hover:bg-muted mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>

            {/* Folder Header */}
            <div className="flex items-center gap-3 mb-2">
              <Folder className={`w-8 h-8 ${accentColor}`} />
              <h1 className="text-3xl sm:text-4xl font-bold">{folder.name}</h1>
            </div>
            {folder.description && (
              <p className="text-muted-foreground max-w-2xl">{folder.description}</p>
            )}
            <Badge className={`mt-3 ${accentBg}`}>
              {folderProjects.length} project{folderProjects.length !== 1 ? 's' : ''}
            </Badge>
          </motion.div>

          {/* Filters & View Controls - matching Projects page */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8"
          >
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
              <Select value={activeCategory} onValueChange={setActiveCategory}>
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

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[120px] sm:w-[160px] h-8 sm:h-9 text-xs sm:text-sm pl-8"
              />
            </div>
          </motion.div>

          {/* Projects Display */}
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No projects in this folder yet.</p>
            </div>
          ) : viewMode === 'cards' ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Card 
                    className="cursor-pointer hover:shadow-lg transition-all overflow-hidden group"
                    onClick={() => navigate(`/projects/${project.id}`, { state: { fromFolder: folderId } })}
                  >
                    <div className="relative aspect-video overflow-hidden">
                        {project.image_drive_id ? (
                          <img 
                            src={project.image_drive_id.startsWith('http') 
                              ? project.image_drive_id 
                              : generateDriveImageUrl(project.image_drive_id, 'medium')} 
                            alt={project.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                          <span className="text-muted-foreground">No Image</span>
                        </div>
                      )}
                      {project.featured && (
                        <Badge className={`absolute top-3 left-3 bg-gradient-to-r ${
                          mode === 'creative' 
                            ? 'from-orange-500 to-orange-600' 
                            : 'from-blue-600 to-purple-600'
                        } text-white`}>
                          Featured
                        </Badge>
                      )}
                    </div>
                    <CardHeader className="p-4">
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
                      <CardTitle className="text-lg">{project.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 text-sm">
                        <Tag className="w-3 h-3" />
                        {project.category}
                        {project.project_date && (
                          <>
                            <span className="mx-1">•</span>
                            <Calendar className="w-3 h-3" />
                            {project.project_date}
                          </>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-sm text-muted-foreground line-clamp-2 mb-3 prose-sm prose-p:my-0">
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
                      <div className="flex flex-wrap gap-1.5">
                        {project.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                        {project.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{project.tags.length - 3}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            /* Timeline View */
            <div className="relative">
              <div className="absolute left-4 md:left-8 top-0 bottom-0 w-0.5 bg-border"></div>
              <div className="space-y-8">
                {filteredProjects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="relative pl-12 md:pl-16"
                  >
                    <div className={`absolute left-2 md:left-6 w-4 h-4 rounded-full border-4 border-background bg-primary`}></div>
                    <Card 
                      className="hover:shadow-lg transition-shadow overflow-hidden cursor-pointer"
                      onClick={() => navigate(`/projects/${project.id}`, { state: { fromFolder: folderId } })}
                    >
                      <div className="flex flex-col md:flex-row">
                        <div className="relative w-full md:w-1/3 aspect-video md:aspect-auto overflow-hidden">
                          {project.image_drive_id ? (
                            <img 
                              src={project.image_drive_id.startsWith('http') 
                                ? project.image_drive_id 
                                : generateDriveImageUrl(project.image_drive_id, 'medium')} 
                              alt={project.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full min-h-[200px] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                              <span className="text-muted-foreground">No Image</span>
                            </div>
                          )}
                        </div>
                        <div className="w-full md:w-2/3">
                          <CardHeader>
                            <CardTitle>{project.title}</CardTitle>
                            <CardDescription className="flex items-center gap-2 flex-wrap">
                              <Tag className="w-4 h-4" />
                              {project.category}
                              {project.project_date && (
                                <span className="flex items-center text-muted-foreground">
                                  <Calendar className="w-4 h-4 mr-1" />
                                  {project.project_date}
                                </span>
                              )}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <p className="text-muted-foreground mb-4 line-clamp-3">{project.description}</p>
                            <div className="flex flex-wrap gap-2 mb-4">
                              {project.tags.slice(0, 4).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              {project.live_url && (
                                <Button size="sm" asChild>
                                  <a href={project.live_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4 mr-1" />
                                    Demo
                                  </a>
                                </Button>
                              )}
                              {project.github_url && (
                                <Button size="sm" variant="outline" asChild>
                                  <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                                    <Github className="w-4 h-4 mr-1" />
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
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProjectFolderPage;
