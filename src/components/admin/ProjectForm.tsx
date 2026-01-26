import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, Image } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { Project } from '@/types/cms';
import GoogleDriveFilePicker from './GoogleDriveFilePicker';
import ImageCropPreview from './ImageCropPreview';
import ProjectMediaManager from './ProjectMediaManager';
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
    image_scroll_enabled: project?.image_scroll_enabled || false,
    crop_landscape: project?.crop_landscape || { x: 50, y: 50, zoom: 100 },
    crop_square: project?.crop_square || { x: 50, y: 50, zoom: 100 },
    crop_phone: project?.crop_phone || { x: 50, y: 50, zoom: 100 },
    crop_tablet: project?.crop_tablet || { x: 50, y: 50, zoom: 100 },
    gallery_images: project?.gallery_images || [],
    video_url: project?.video_url || '',
    video_thumbnail_drive_id: project?.video_thumbnail_drive_id || '',
    github_url: project?.github_url || '',
    live_url: project?.live_url || '',
    order_index: project?.order_index || 0,
    project_date: project?.project_date || '',
    include_thumbnail_in_gallery: project?.include_thumbnail_in_gallery ?? true,
    position: project?.position || ''
  });
  
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerTarget, setFilePickerTarget] = useState<'main' | 'gallery' | 'thumbnail' | 'video'>('main');

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
    if (filePickerTarget === 'main') {
      setFormData(prev => ({
        ...prev,
        image_drive_id: file.id,
        crop_landscape: { x: 50, y: 50, zoom: 100 },
        crop_square: { x: 50, y: 50, zoom: 100 },
        crop_phone: { x: 50, y: 50, zoom: 100 },
        crop_tablet: { x: 50, y: 50, zoom: 100 }
      }));
    } else if (filePickerTarget === 'gallery') {
      const imageUrl = generateDriveImageUrl(file.id, 'large');
      setFormData(prev => ({
        ...prev,
        gallery_images: [...prev.gallery_images, imageUrl]
      }));
    } else if (filePickerTarget === 'thumbnail') {
      setFormData(prev => ({
        ...prev,
        video_thumbnail_drive_id: file.id
      }));
    } else if (filePickerTarget === 'video') {
      const driveVideoUrl = `https://drive.google.com/file/d/${file.id}/preview`;
      setFormData(prev => ({
        ...prev,
        video_url: driveVideoUrl
      }));
    }
    setShowFilePicker(false);
  };

  const openFilePicker = (target: 'main' | 'gallery' | 'thumbnail' | 'video') => {
    setFilePickerTarget(target);
    setShowFilePicker(true);
  };

  const removeImage = () => {
    setFormData(prev => ({ 
      ...prev, 
      image_drive_id: '',
      crop_landscape: { x: 50, y: 50, zoom: 100 },
      crop_square: { x: 50, y: 50, zoom: 100 },
      crop_phone: { x: 50, y: 50, zoom: 100 },
      crop_tablet: { x: 50, y: 50, zoom: 100 }
    }));
  };

  const getImageUrl = (imageId: string) => {
    return imageId.startsWith('http') ? imageId : generateDriveImageUrl(imageId, 'medium');
  };

  const getFileTypesForPicker = () => {
    if (filePickerTarget === 'video') {
      return ['video'] as ('image' | 'video' | 'document')[];
    }
    return ['image'] as ('image' | 'video' | 'document')[];
  };

  if (showFilePicker) {
    return (
      <GoogleDriveFilePicker
        onSelect={handleFileSelect}
        onCancel={() => setShowFilePicker(false)}
        selectedFileId={filePickerTarget === 'main' ? formData.image_drive_id : undefined}
        fileTypes={getFileTypesForPicker()}
      />
    );
  }

  return (
    <Card className="w-full max-h-[90vh] overflow-y-auto">
      <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-card z-10">
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
          {/* Basic Info */}
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

          {/* Position field - Creative Mode Only */}
          {mode === 'creative' && (
            <div>
              <Label htmlFor="position">Position/Role (Creative Mode)</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                placeholder="e.g., Chairman, Lead Designer, Assistant"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your role or position in this creative project
              </p>
            </div>
          )}

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

          {/* Main Thumbnail Image */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Main Thumbnail Image</Label>
            <p className="text-xs text-muted-foreground">
              This image is used as the project card thumbnail on the Projects page and Home page.
            </p>
            
            {formData.image_drive_id ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img
                    src={getImageUrl(formData.image_drive_id)}
                    alt="Project image"
                    className="w-32 h-20 object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2"
                    onClick={removeImage}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <ImageCropPreview
                  imageUrl={getImageUrl(formData.image_drive_id)}
                  cropLandscape={formData.crop_landscape}
                  cropSquare={formData.crop_square}
                  cropTablet={formData.crop_tablet}
                  onCropLandscapeChange={(crop) => setFormData(prev => ({ ...prev, crop_landscape: crop }))}
                  onCropSquareChange={(crop) => setFormData(prev => ({ ...prev, crop_square: crop }))}
                  onCropTabletChange={(crop) => setFormData(prev => ({ ...prev, crop_tablet: crop }))}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openFilePicker('main')}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Change Image
                </Button>

                <div className="flex items-center space-x-2 pt-2 border-t">
                  <Switch
                    id="image_scroll_enabled"
                    checked={formData.image_scroll_enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, image_scroll_enabled: checked }))}
                  />
                  <Label htmlFor="image_scroll_enabled" className="text-sm">
                    Enable scroll effect on Projects page (for tall images)
                  </Label>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  placeholder="Enter image URL"
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
                  onClick={() => openFilePicker('main')}
                  className="w-full"
                >
                  <Image className="w-4 h-4 mr-2" />
                  Select from Google Drive
                </Button>
              </div>
            )}
          </div>

          {/* Gallery & Video Media Manager */}
          <ProjectMediaManager
            galleryImages={formData.gallery_images}
            videoUrl={formData.video_url}
            videoThumbnail={formData.video_thumbnail_drive_id}
            includeThumbnailInGallery={formData.include_thumbnail_in_gallery}
            onGalleryImagesChange={(images) => setFormData(prev => ({ ...prev, gallery_images: images }))}
            onVideoUrlChange={(url) => setFormData(prev => ({ ...prev, video_url: url }))}
            onVideoThumbnailChange={(url) => setFormData(prev => ({ ...prev, video_thumbnail_drive_id: url }))}
            onIncludeThumbnailInGalleryChange={(value) => setFormData(prev => ({ ...prev, include_thumbnail_in_gallery: value }))}
            onOpenFilePicker={(target) => openFilePicker(target)}
          />

          {/* Links */}
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

          {/* Tags */}
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

          {/* Featured Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="featured"
              checked={formData.featured}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
            />
            <Label htmlFor="featured">Featured Project</Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4 sticky bottom-0 bg-card py-4">
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
