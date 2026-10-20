
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Image, ExternalLink, Github, Search, Filter, Home, Star, EyeOff, RefreshCw, Link2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useProjects } from '@/hooks/useProjects';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import ProjectForm from './ProjectForm';
import GithubImportDialog from './GithubImportDialog';
import GithubSyncDialog from './GithubSyncDialog';
import { useGithubSyncStatus } from '@/hooks/useGithubSyncStatus';
import type { Project } from '@/types/cms';
import ProjectFilterViews from './ProjectFilterViews';
import { usePortfolio } from '@/contexts/PortfolioContext';

const timeAgo = (iso: string): string => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const ProjectManager = () => {
  const { mode } = usePortfolio();
  const { projects, loading, deleteProject, refetch } = useProjects(mode, { includeInactive: true });
  const { statuses: syncStatuses, refresh: refreshSyncStatus } = useGithubSyncStatus(mode);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  // The project open in the GitHub sync dialog, and the fields it ticked, waiting in the edit form for review.
  const [syncingProject, setSyncingProject] = useState<Project | null>(null);
  const [syncOverrides, setSyncOverrides] = useState<Partial<Project> | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // A draft imported from GitHub, waiting in the (new-project) form for review.
  const [importedDraft, setImportedDraft] = useState<Partial<Project> | undefined>(undefined);

  const openNewProjectForm = () => {
    setImportedDraft(undefined); // a manual "Add" never inherits an earlier import
    setShowForm(true);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewFilter, setViewFilter] = useState<'all' | 'featured' | 'recent'>('all');

  // Get unique categories - include both category and categories array (like projects page)
  const categories = useMemo(() => {
    const cats = new Set(
      projects.flatMap(p => 
        p.categories?.length 
          ? p.categories 
          : [p.category || 'uncategorized']
      ).filter(Boolean)
    );
    return ['all', ...Array.from(cats)];
  }, [projects]);

  // Filter projects - check both category and categories array
  const filteredProjects = useMemo(() => {
    let filtered = projects;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.title.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        project.tags.some(tag => tag.toLowerCase().includes(query)) ||
        (project.category || 'uncategorized').toLowerCase().includes(query) ||
        project.categories?.some(cat => cat.toLowerCase().includes(query))
      );
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(project => {
        const projectCategories = project.categories?.length 
          ? project.categories 
          : [project.category || 'uncategorized'];
        return projectCategories.includes(selectedCategory);
      });
    }
    
    return filtered;
  }, [projects, searchQuery, selectedCategory]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject(id);
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading projects...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Projects</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Showing <strong className="capitalize">{mode}</strong> mode projects. Use mode toggle (bottom left) to switch.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Github className="w-4 h-4 mr-2" />
            Import from GitHub
          </Button>
          <Button onClick={openNewProjectForm}>
            <Plus className="w-4 h-4 mr-2" />
            Add Project
          </Button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {categories.length > 1 && (
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[160px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories
                .filter(category => category && category.trim() !== '') // Extra safety check
                .map((category) => (
                  <SelectItem key={category} value={category} className="capitalize">
                    {category}
                  </SelectItem>
                ))
              }
            </SelectContent>
          </Select>
        )}
        
        <p className="text-sm text-muted-foreground">
          {filteredProjects.length} of {projects.length} projects
        </p>
      </div>

      {/* View Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={viewFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewFilter('all')}
        >
          All ({projects.length})
        </Button>
        <Button
          variant={viewFilter === 'featured' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewFilter('featured')}
        >
          <Star className="w-3 h-3 mr-1" />
          Featured ({projects.filter(p => p.featured).length})
        </Button>
        <Button
          variant={viewFilter === 'recent' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewFilter('recent')}
        >
          <Home className="w-3 h-3 mr-1" />
          Recent Work ({projects.filter(p => p.show_in_recent !== false).length})
        </Button>
      </div>

      {/* Featured/Recent Filter Views */}
      {viewFilter !== 'all' && (
        <ProjectFilterViews
          projects={filteredProjects}
          viewFilter={viewFilter}
          mode={mode}
          onRefetch={refetch}
        />
      )}

      <GithubImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        mode={mode}
        onUseDraft={(draft) => {
          setImportedDraft(draft);
          setShowForm(true);
        }}
      />

      <GithubSyncDialog
        project={syncingProject}
        mode={mode}
        onOpenChange={(open) => !open && setSyncingProject(null)}
        onApply={(updates) => {
          if (!syncingProject) return;
          setSyncOverrides(updates);
          setEditingProject(syncingProject.id);
        }}
      />

      {/* Add Project Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent 
          className="max-w-4xl h-[90vh] p-0" 
          hideCloseButton
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <ProjectForm
            initialDraft={importedDraft}
            onClose={() => {
              setShowForm(false);
              setImportedDraft(undefined);
            }}
            onSave={() => {
              setShowForm(false);
              setImportedDraft(undefined);
              refetch();
            }}
            mode={mode}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog
        open={!!editingProject}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProject(null);
            setSyncOverrides(undefined);
          }
        }}
      >
        <DialogContent 
          className="max-w-4xl h-[90vh] p-0" 
          hideCloseButton
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <ProjectForm
            project={projects.find(p => p.id === editingProject)}
            initialDraft={syncOverrides}
            onClose={() => {
              setEditingProject(null);
              setSyncOverrides(undefined);
            }}
            onSave={() => {
              setEditingProject(null);
              setSyncOverrides(undefined);
              refetch();
              void refreshSyncStatus();
            }}
            mode={mode}
          />
        </DialogContent>
      </Dialog>

      {viewFilter === 'all' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.filter(p => p.id !== editingProject).map((project) => (
        
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group"
          >
            <Card className={`hover:shadow-lg transition-shadow h-full flex flex-col ${project.is_active === false ? 'opacity-60 border-dashed' : ''}`}>
              <div className="relative">
                {project.image_drive_id ? (
                  <img
                    src={project.image_drive_id.startsWith('http') 
                      ? project.image_drive_id 
                      : generateDriveImageUrl(project.image_drive_id, 'medium')}
                    alt={project.title}
                    className="w-full h-40 object-cover rounded-t-lg"
                  />
                ) : (
                  <div className="w-full h-40 bg-muted rounded-t-lg flex items-center justify-center">
                    <Image className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                
                {/* Status badges */}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  {project.featured && (
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      <Star className="w-3 h-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                  {project.is_active === false && (
                    <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                      <EyeOff className="w-3 h-3 mr-1" />
                      Inactive
                    </Badge>
                  )}
                  {project.show_in_recent !== false && (
                    <Badge variant="secondary" className="text-xs">
                      <Home className="w-3 h-3 mr-1" />
                      Recent
                    </Badge>
                  )}
                </div>
                
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 p-0"
                      title={project.github_url ? 'Sync with GitHub' : 'Link to GitHub'}
                      aria-label={project.github_url ? 'Sync with GitHub' : 'Link to GitHub'}
                      onClick={() => setSyncingProject(project)}
                    >
                      {project.github_url ? <RefreshCw className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 p-0"
                      aria-label="Edit project"
                      onClick={() => setEditingProject(project.id)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDelete(project.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <CardHeader className="pb-2">
                <CardTitle className="text-base line-clamp-1">{project.title}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs">{project.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col justify-end">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">
                      {project.category}
                    </Badge>
                    {project.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {project.tags.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{project.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                  
                  {project.github_url && (
                    <p className="text-xs">
                      {syncStatuses[project.id]?.state === 'changed' ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">Repository updated since last sync</span>
                      ) : project.github_synced_at ? (
                        <span className="text-muted-foreground">Synced {timeAgo(project.github_synced_at)}</span>
                      ) : (
                        <span className="text-muted-foreground">Not synced from GitHub</span>
                      )}
                    </p>
                  )}

                  <div className="flex space-x-2">
                    {project.github_url && (
                      <Button size="sm" variant="outline" className="h-7 text-xs flex-1" asChild>
                        <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                          <Github className="w-3 h-3 mr-1" />
                          Code
                        </a>
                      </Button>
                    )}
                    {project.live_url && (
                      <Button size="sm" variant="outline" className="h-7 text-xs flex-1" asChild>
                        <a href={project.live_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Live
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      )}

      {viewFilter === 'all' && filteredProjects.length === 0 && projects.length > 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">No projects match your search criteria</p>
            <Button variant="outline" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {projects.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">No projects found for {mode} mode</p>
            <Button onClick={openNewProjectForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Project
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProjectManager;
