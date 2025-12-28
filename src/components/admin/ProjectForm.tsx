import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, Plus, Image } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { Project } from '@/types/cms';
import GoogleDriveFilePicker from './GoogleDriveFilePicker';
import { DriveFile } from '@/services/googleDriveService';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { SingleDatePicker } from '@/components/ui/date-range-picker';

interface ProjectFormProps {
  project?: Project;
  onClose: () => void;
  onSave: () => void;
  mode: 'professional' | 'creative';
}

const ProjectForm = ({ project, onClose, onSave, mode }: ProjectFormProps) => {
  const { addProject, updateProject } = useProjects();
  
  const [formData, setFormData] = useState({
    title: project?.title || '',
    description: project?.description || '',
    category: project?.category || '',
    tags: project?.tags || [],
    featured: project?.featured || false,
    image_drive_id: project?.image_drive_id || '',
    github_url: project?.github_url || '',
    live_url: project?.live_url || '',
    order_index: project?.order_index || 0,
    project_date: project?.project_date || ''
  });
  
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const projectData = {
        ...formData,
        mode,
        order_index: formData.order_index || 0
      };

      if (project) {
        await updateProject(project.id, projectData);
      } else {
        await addProject(projectData);
      }
      
      onSave();
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('Failed to save project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(newTag.trim())) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, newTag.trim()]
        }));
      }
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleFileSelect = (file: DriveFile) => {
    setFormData(prev => ({
      ...prev,
      image_drive_id: file.id
    }));
    setShowFilePicker(false);
  };

  const removeSelectedImage = () => {
    setFormData(prev => ({
      ...prev,
      image_drive_id: ''
    }));
  };

  if (showFilePicker) {
    return (
      <GoogleDriveFilePicker
        onSelect={handleFileSelect}
        onCancel={() => setShowFilePicker(false)}
        selectedFileId={formData.image_drive_id}
        fileTypes={['image', 'video']}
      />
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{project ? 'Edit Project' : 'Add New Project'}</CardTitle>
          <CardDescription>
            {project ? 'Update project details' : 'Create a new project for your portfolio'}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Project title"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., Web Development"
                required
              />
            </div>
          </div>

          <div>
            <Label>Project Date</Label>
            <SingleDatePicker
              value={formData.project_date}
              onChange={(value) => setFormData(prev => ({ ...prev, project_date: value }))}
              placeholder="Select project date"
              showFormatSelector={true}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your project..."
              rows={3}
              required
            />
          </div>

          <div>
            <Label>Project Image</Label>
            {formData.image_drive_id ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img
                    src={formData.image_drive_id.startsWith('http') 
                      ? formData.image_drive_id 
                      : generateDriveImageUrl(formData.image_drive_id, 'small')}
                    alt="Selected project image"
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2"
                    onClick={removeSelectedImage}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowFilePicker(true)}
                  >
                    <Image className="w-4 h-4 mr-2" />
                    Change from Drive
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                  value={formData.image_drive_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, image_drive_id: e.target.value }))}
                />
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">OR</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFilePicker(true)}
                  className="w-full"
                >
                  <Image className="w-4 h-4 mr-2" />
                  Select from Google Drive
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Enter an image URL directly or choose from Google Drive
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="github_url">GitHub URL (Optional)</Label>
              <Input
                id="github_url"
                value={formData.github_url}
                onChange={(e) => setFormData(prev => ({ ...prev, github_url: e.target.value }))}
                placeholder="https://github.com/username/repo"
              />
            </div>
            
            <div>
              <Label htmlFor="live_url">Live Demo URL (Optional)</Label>
              <Input
                id="live_url"
                value={formData.live_url}
                onChange={(e) => setFormData(prev => ({ ...prev, live_url: e.target.value }))}
                placeholder="https://yourproject.com"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={addTag}
              placeholder="Type a tag and press Enter"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                  {tag}
                  <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="featured"
              checked={formData.featured}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
            />
            <Label htmlFor="featured">Featured Project</Label>
          </div>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : project ? 'Update Project' : 'Add Project'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProjectForm;
