import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, Github, Calendar, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useProjects } from '@/hooks/useProjects';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { Project } from '@/types/cms';

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mode, darkMode } = usePortfolio();
  const { projects, loading } = useProjects(mode);
  const [project, setProject] = useState<Project | null>(null);
  const [adjacentProjects, setAdjacentProjects] = useState<{ prev: Project | null; next: Project | null }>({ prev: null, next: null });

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
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Button 
              variant="ghost" 
              onClick={() => navigate('/projects')}
              className="mb-6 hover:bg-muted"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
          </motion.div>

          {/* Project Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Project Image */}
            <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-xl overflow-hidden mb-8">
              {project.image_drive_id ? (
                <img 
                  src={project.image_drive_id.startsWith('http') 
                    ? project.image_drive_id 
                    : generateDriveImageUrl(project.image_drive_id, 'large')} 
                  alt={project.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  <span className="text-muted-foreground">No Image Available</span>
                </div>
              )}
              {project.featured && (
                <Badge className={`absolute top-4 left-4 bg-gradient-to-r ${
                  mode === 'creative' 
                    ? 'from-orange-500 to-orange-600' 
                    : 'from-blue-600 to-purple-600'
                } text-white`}>
                  Featured
                </Badge>
              )}
            </div>

            {/* Project Title & Meta */}
            <div className="mb-8">
              <h1 className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r ${
                mode === 'creative' 
                  ? 'from-orange-500 to-orange-600' 
                  : 'from-blue-600 to-purple-600'
              } bg-clip-text text-transparent`}>
                {project.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-3 text-muted-foreground mb-6">
                <span className="flex items-center">
                  <Tag className="w-4 h-4 mr-1.5" />
                  {project.category}
                </span>
                {project.project_date && (
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1.5" />
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
                  <Button variant="outline" className="gap-2" asChild>
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
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {project.description}
              </p>
            </div>

            {/* Navigation to Adjacent Projects */}
            <div className="border-t border-border pt-8">
              <div className="flex justify-between items-center">
                {adjacentProjects.prev ? (
                  <Button 
                    variant="ghost" 
                    onClick={() => navigate(`/projects/${adjacentProjects.prev!.id}`)}
                    className="flex items-center gap-2 hover:bg-muted"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <div className="text-left">
                      <div className="text-xs text-muted-foreground">Previous</div>
                      <div className="text-sm font-medium truncate max-w-[150px] sm:max-w-[200px]">
                        {adjacentProjects.prev.title}
                      </div>
                    </div>
                  </Button>
                ) : (
                  <div />
                )}
                
                {adjacentProjects.next ? (
                  <Button 
                    variant="ghost" 
                    onClick={() => navigate(`/projects/${adjacentProjects.next!.id}`)}
                    className="flex items-center gap-2 hover:bg-muted"
                  >
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Next</div>
                      <div className="text-sm font-medium truncate max-w-[150px] sm:max-w-[200px]">
                        {adjacentProjects.next.title}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <div />
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
