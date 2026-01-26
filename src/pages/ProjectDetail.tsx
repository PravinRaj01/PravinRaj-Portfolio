import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, Github, Calendar, Tag, ChevronLeft, ChevronRight, User, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import ProjectImageGallery from '@/components/ProjectImageGallery';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useProjects } from '@/hooks/useProjects';
import { useProjectFolders } from '@/hooks/useProjectFolders';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { Project } from '@/types/cms';
import ReactMarkdown from 'react-markdown';

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, darkMode } = usePortfolio();
  const { projects, loading } = useProjects(mode);
  const { folders } = useProjectFolders(mode);
  const [project, setProject] = useState<Project | null>(null);
  const [adjacentProjects, setAdjacentProjects] = useState<{ prev: Project | null; next: Project | null }>({ prev: null, next: null });
  
  // Check if came from folder view
  const fromFolder = (location.state as { fromFolder?: string })?.fromFolder;

  useEffect(() => {
    if (projects.length > 0 && id) {
      const currentIndex = projects.findIndex(p => p.id === id);
      if (currentIndex !== -1) {
        setProject(projects[currentIndex]);
        setAdjacentProjects({
          prev: currentIndex > 0 ? projects[currentIndex - 1] : null,
          next: currentIndex < projects.length - 1 ? projects[currentIndex + 1] : null,
        });
      }
    }
  }, [projects, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <CursorFollower />
        <RadialGradient scale="scale-y-100" opacity={darkMode ? "opacity-30" : "opacity-30"} />
        <Navigation />
        <div className="pt-24 px-4">
          <div className="container mx-auto py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading project...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <CursorFollower />
        <RadialGradient scale="scale-y-100" opacity={darkMode ? "opacity-30" : "opacity-30"} />
        <Navigation />
        <div className="pt-24 px-4">
          <div className="container mx-auto py-12 text-center">
            <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
            <p className="text-muted-foreground mb-6">The project you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/projects')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <CursorFollower />
      <RadialGradient scale="scale-y-100" opacity={darkMode ? "opacity-30" : "opacity-30"} />
      <Navigation />

      <div className="pt-20 sm:pt-24 px-4">
        <div className="container mx-auto max-w-4xl py-8">
          {/* Breadcrumb & Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Breadcrumb for folder context */}
            {project?.folder_id && folders.find(f => f.id === project.folder_id) && (
              <div className="flex items-center gap-1 sm:gap-2 text-sm text-muted-foreground mb-2 flex-wrap">
                <span 
                  className="hover:text-foreground cursor-pointer flex-shrink-0"
                  onClick={() => navigate('/projects')}
                >
                  Projects
                </span>
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span 
                  className={`hover:text-foreground cursor-pointer flex items-center gap-1 flex-shrink-0 ${
                    mode === 'creative' ? 'text-orange-400' : 'text-purple-400'
                  }`}
                  onClick={() => navigate(`/projects/folder/${project.folder_id}`)}
                >
                  <Folder className="w-3 h-3" />
                  <span className="max-w-[80px] sm:max-w-[150px] truncate">{folders.find(f => f.id === project.folder_id)?.name}</span>
                </span>
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="text-foreground truncate max-w-[100px] sm:max-w-[200px]">{project.title}</span>
              </div>
            )}
            
            <Button 
              variant="ghost" 
              onClick={() => {
                if (fromFolder) {
                  navigate(`/projects/folder/${fromFolder}`);
                } else if (project?.folder_id) {
                  navigate(`/projects/folder/${project.folder_id}`);
                } else {
                  navigate('/projects');
                }
              }}
              className="mb-6 hover:bg-muted"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {fromFolder || project?.folder_id 
                ? `Back to ${folders.find(f => f.id === (fromFolder || project?.folder_id))?.name || 'Folder'}` 
                : 'Back to Projects'}
            </Button>
          </motion.div>

          {/* Project Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Project Image Gallery */}
            {(() => {
              const mainImage = project.image_drive_id 
                ? (project.image_drive_id.startsWith('http') 
                    ? project.image_drive_id 
                    : generateDriveImageUrl(project.image_drive_id, 'large'))
                : null;
              
              // Filter out VIDEO_MARKER and build gallery
              const VIDEO_MARKER = '__VIDEO__';
              const rawGallery = project.gallery_images || [];
              
              const galleryImages: string[] = [];
              let videoPosition = -1;
              
              rawGallery.forEach((img, idx) => {
                if (img === VIDEO_MARKER) {
                  videoPosition = galleryImages.length; // Track where video should be
                } else {
                  const url = img.startsWith('http') ? img : generateDriveImageUrl(img, 'large');
                  galleryImages.push(url);
                }
              });
              
              // Build final media array with video in correct position
              // Check include_thumbnail_in_gallery setting (default true for backward compatibility)
              const shouldIncludeThumbnail = project.include_thumbnail_in_gallery !== false;
              
              let finalMedia: string[] = [];
              if (shouldIncludeThumbnail && mainImage && !galleryImages.includes(mainImage)) {
                finalMedia = [mainImage, ...galleryImages];
                if (videoPosition >= 0) videoPosition++; // Adjust for main image
              } else if (galleryImages.length > 0) {
                finalMedia = galleryImages;
              } else if (shouldIncludeThumbnail && mainImage) {
                finalMedia = [mainImage];
              }

              const videoThumbnail = project.video_thumbnail_drive_id
                ? (project.video_thumbnail_drive_id.startsWith('http')
                    ? project.video_thumbnail_drive_id
                    : generateDriveImageUrl(project.video_thumbnail_drive_id, 'large'))
                : mainImage;

              return (
                <div className="relative mb-8">
                  <ProjectImageGallery
                    images={finalMedia}
                    videoUrl={project.video_url}
                    videoThumbnail={project.video_url ? videoThumbnail || undefined : undefined}
                    videoPosition={videoPosition >= 0 ? videoPosition : undefined}
                    title={project.title}
                    mode={mode}
                  />
                  {project.featured && (
                    <Badge className={`absolute top-4 left-4 z-10 bg-gradient-to-r ${
                      mode === 'creative' 
                        ? 'from-orange-500 to-orange-600' 
                        : 'from-blue-600 to-purple-600'
                    } text-white`}>
                      Featured
                    </Badge>
                  )}
                </div>
              );
            })()}

            {/* Project Title & Meta */}
            <div className="mb-8">
              {/* Position Badges for Creative Mode */}
              {mode === 'creative' && (project.positions?.length ? project.positions : project.position ? [project.position] : []).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {(project.positions?.length ? project.positions : project.position ? [project.position] : []).map((pos, idx) => (
                    <Badge key={idx} className="bg-orange-500/20 text-orange-400 border-orange-500/30 max-w-[200px] truncate">
                      <User className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{pos}</span>
                    </Badge>
                  ))}
                </div>
              )}
              
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground">
                {project.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-muted-foreground mb-6">
                <span className="flex items-center text-sm sm:text-base">
                  <Tag className="w-4 h-4 mr-1.5 flex-shrink-0" />
                  <span className="truncate max-w-[150px] sm:max-w-none">
                    {(project.categories?.length ? project.categories : [project.category]).join(' / ')}
                  </span>
                </span>
                {project.project_date && (
                  <span className="flex items-center text-sm sm:text-base">
                    <Calendar className="w-4 h-4 mr-1.5 flex-shrink-0" />
                    {project.project_date}
                  </span>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {project.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-sm px-3 py-1"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {project.live_url && (
                  <Button className="gap-2" asChild>
                    <a href={project.live_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                      {mode === 'professional' ? 'View Live Demo' : 'View Project'}
                    </a>
                  </Button>
                )}
                {project.github_url && (
                  <Button 
                    variant="outline" 
                    className={`gap-2 ${
                      mode === 'creative' 
                        ? 'border-orange-500 text-orange-500 hover:bg-orange-500/10' 
                        : 'border-purple-500 text-purple-500 hover:bg-purple-500/10'
                    }`} 
                    asChild
                  >
                    <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                      <Github className="w-4 h-4" />
                      View Source Code
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Project Description */}
            <div className="prose prose-lg dark:prose-invert max-w-none mb-12">
              <h2 className="text-xl font-semibold mb-4">About This Project</h2>
              {mode === 'creative' ? (
                <div className="text-muted-foreground leading-relaxed prose-headings:text-foreground prose-strong:text-foreground prose-ul:text-muted-foreground prose-ol:text-muted-foreground">
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
                    {project.description}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {project.description}
                </p>
              )}
            </div>

            {/* Navigation to Adjacent Projects */}
            <div className="border-t border-border pt-8">
              <div className="flex flex-row justify-between items-center gap-2">
                {adjacentProjects.prev ? (
                  <Button 
                    variant="ghost" 
                    onClick={() => navigate(`/projects/${adjacentProjects.prev!.id}`)}
                    className="flex items-center gap-1 sm:gap-2 hover:bg-muted min-w-0 flex-1 justify-start px-2 sm:px-4"
                  >
                    <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                    <div className="text-left min-w-0 hidden sm:block">
                      <div className="text-xs text-muted-foreground">Previous</div>
                      <div className="text-sm font-medium truncate max-w-[100px] sm:max-w-[150px]">
                        {adjacentProjects.prev.title}
                      </div>
                    </div>
                    <span className="sm:hidden text-xs">Prev</span>
                  </Button>
                ) : (
                  <div className="flex-1" />
                )}
                
                {adjacentProjects.next ? (
                  <Button 
                    variant="ghost" 
                    onClick={() => navigate(`/projects/${adjacentProjects.next!.id}`)}
                    className="flex items-center gap-1 sm:gap-2 hover:bg-muted min-w-0 flex-1 justify-end px-2 sm:px-4"
                  >
                    <span className="sm:hidden text-xs">Next</span>
                    <div className="text-right min-w-0 hidden sm:block">
                      <div className="text-xs text-muted-foreground">Next</div>
                      <div className="text-sm font-medium truncate max-w-[100px] sm:max-w-[150px]">
                        {adjacentProjects.next.title}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  </Button>
                ) : (
                  <div className="flex-1" />
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
