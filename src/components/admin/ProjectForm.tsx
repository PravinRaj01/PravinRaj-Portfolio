import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { X, Image, Folder, Plus, Link as LinkIcon, Trash2, Eye, EyeOff } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useProjectFolders } from '@/hooks/useProjectFolders';
import { Project, ProjectLink } from '@/types/cms';
import GoogleDriveFilePicker, { FolderNavigationItem } from './GoogleDriveFilePicker';
import ImageCropPreview from './ImageCropPreview';
import ProjectMediaManager from './ProjectMediaManager';
import ProjectImageFolderManager from './ProjectImageFolderManager';
import DescriptionGenerator from './DescriptionGenerator';
import { DriveFile } from '@/services/googleDriveService';
import { ApiError } from '@/services/apiClient';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { SingleDatePicker } from '@/components/ui/date-range-picker';

interface ProjectFormProps {
  project?: Project;
  /**
   * Pre-fills the form for a NEW project (e.g. a draft imported from GitHub).
   * Ignored when `project` is set: editing always starts from the saved project.
   */
  initialDraft?: Partial<Project>;
  onClose: () => void;
  onSave: () => void;
  mode: 'professional' | 'creative';
}

const ProjectForm = ({ project, initialDraft, onClose, onSave, mode }: ProjectFormProps) => {
  const { addProject, updateProject } = useProjects();
  const { folders } = useProjectFolders(mode);
  
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // A draft only pre-fills a new project; editing starts from the saved one.
  const seed: Partial<Project> | undefined = project ?? initialDraft;

  const [formData, setFormData] = useState({
    title: seed?.title || '',
    slug: seed?.slug || '',
    description: seed?.description || '',
    category: seed?.category || '',
    categories: seed?.categories || [],
    tags: seed?.tags || [],
    featured: seed?.featured || false,
    show_in_recent: seed?.show_in_recent ?? true,
    is_active: seed?.is_active ?? true,
    image_drive_id: seed?.image_drive_id || '',
    image_scroll_enabled: seed?.image_scroll_enabled || false,
    scroll_speed: seed?.scroll_speed ?? 10000,
    crop_landscape: seed?.crop_landscape || { x: 50, y: 50, zoom: 100 },
    crop_square: seed?.crop_square || { x: 50, y: 50, zoom: 100 },
    crop_phone: seed?.crop_phone || { x: 50, y: 50, zoom: 100 },
    crop_tablet: seed?.crop_tablet || { x: 50, y: 50, zoom: 100 },
    gallery_images: seed?.gallery_images || [],
    video_url: seed?.video_url || '',
    video_thumbnail_drive_id: seed?.video_thumbnail_drive_id || '',
    github_url: seed?.github_url || '',
    live_url: seed?.live_url || '',
    project_links: seed?.project_links || [] as ProjectLink[],
    order_index: seed?.order_index || 0,
    project_date: seed?.project_date || '',
    date_display: (seed?.date_display ?? 'month') as 'month' | 'full',
    include_thumbnail_in_gallery: seed?.include_thumbnail_in_gallery ?? true,
    position: seed?.position || '',
    positions: seed?.positions || [],
    folder_id: seed?.folder_id || null
  });
  
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkShowOnCard, setNewLinkShowOnCard] = useState(false);
  
  const [newTag, setNewTag] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerTarget, setFilePickerTarget] = useState<'main' | 'gallery' | 'thumbnail' | 'video'>('main');
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  
  // Store last navigation position for file picker
  const [lastFolderId, setLastFolderId] = useState<string | null>(null);
  const [lastNavStack, setLastNavStack] = useState<FolderNavigationItem[]>([]);

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
      // A 401 is already explained by the "session expired" prompt shown over
      // the admin, so don't stack a second alert on top of it.
      if (error instanceof ApiError && error.status === 401) return;
      const reason = error instanceof Error && error.message ? `: ${error.message}` : '';
      alert(`Failed to save project${reason}`);
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

  const addCategory = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newCategory.trim()) {
      e.preventDefault();
      if (!formData.categories.includes(newCategory.trim())) {
        setFormData(prev => ({
          ...prev,
          categories: [...prev.categories, newCategory.trim()],
          category: prev.category || newCategory.trim()
        }));
      }
      setNewCategory('');
    }
  };

  const removeCategory = (catToRemove: string) => {
    setFormData(prev => {
      const newCategories = prev.categories.filter(c => c !== catToRemove);
      return {
        ...prev,
        categories: newCategories,
        category: newCategories[0] || ''
      };
    });
  };

  const addPosition = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newPosition.trim()) {
      e.preventDefault();
      if (!formData.positions.includes(newPosition.trim())) {
        setFormData(prev => ({
          ...prev,
          positions: [...prev.positions, newPosition.trim()],
          position: prev.position || newPosition.trim()
        }));
      }
      setNewPosition('');
    }
  };

  const removePosition = (posToRemove: string) => {
    setFormData(prev => {
      const newPositions = prev.positions.filter(p => p !== posToRemove);
      return {
        ...prev,
        positions: newPositions,
        position: newPositions[0] || ''
      };
    });
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
    setMultiSelectMode(false);
  };

  const handleMultiFileSelect = (files: DriveFile[]) => {
    const newUrls = files.map(file => generateDriveImageUrl(file.id, 'large'));
    setFormData(prev => ({
      ...prev,
      gallery_images: [...prev.gallery_images, ...newUrls]
    }));
    setShowFilePicker(false);
    setMultiSelectMode(false);
  };

  const openFilePicker = (target: 'main' | 'gallery' | 'thumbnail' | 'video', isMultiSelect: boolean = false) => {
    setFilePickerTarget(target);
    setMultiSelectMode(isMultiSelect);
    setShowFilePicker(true);
  };

  const handleNavigationChange = (folderId: string | null, stack: FolderNavigationItem[]) => {
    setLastFolderId(folderId);
    setLastNavStack(stack);
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

  return (
    <>
      <div className="flex flex-col h-full max-h-[90vh]">
        {/* Sticky Header */}
        <div className="flex flex-row items-center justify-between bg-background px-6 py-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold">{project ? 'Edit Project' : 'Add New Project'}</h2>
            <p className="text-sm text-muted-foreground">
              {project ? 'Update project details' : 'Create a new project for your portfolio'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="project-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setFormData(prev => ({ 
                      ...prev, 
                      title: newTitle,
                      // Auto-generate slug only if slug hasn't been manually edited or is empty
                      slug: prev.slug === generateSlug(prev.title) || !prev.slug 
                        ? generateSlug(newTitle) 
                        : prev.slug
                    }));
                  }}
                  placeholder="Project title"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }))}
                  placeholder="project-url-slug"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL: /projects/{formData.slug || 'auto-generated'}
                </p>
              </div>
              
              <div>
                <Label htmlFor="category">Category (type & press Enter for multiple)</Label>
                <div className="space-y-2">
                  <Input
                    id="category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={addCategory}
                    placeholder="Type category and press Enter"
                  />
                  <div className="flex flex-wrap gap-2">
                    {formData.categories.map((cat) => (
                      <Badge key={cat} variant="secondary" className="cursor-pointer" onClick={() => removeCategory(cat)}>
                        {cat}
                        <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Folder Selection */}
            <div>
              <Label>Folder (Optional)</Label>
              <Select 
                value={formData.folder_id || 'none'} 
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  folder_id: value === 'none' ? null : value 
                }))}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Select a folder" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Folder</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id || `temp-${folder.name}`}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Organize projects into folders for better categorization
              </p>
            </div>

            {/* Position field - Both Modes */}
            <div>
              <Label htmlFor="position">
                {mode === 'creative' ? 'Position/Role' : 'Your Role'} (type & press Enter for multiple)
              </Label>
              <div className="space-y-2">
                <Input
                  id="position"
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  onKeyDown={addPosition}
                  placeholder={mode === 'creative' ? "e.g., Chairman, Lead Designer" : "e.g., Lead Developer, Architect"}
                />
                <div className="flex flex-wrap gap-2">
                  {formData.positions.map((pos) => (
                    <Badge key={pos} variant="secondary" className="cursor-pointer" onClick={() => removePosition(pos)}>
                      {pos}
                      <X className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Your role(s) or position(s) in this project
              </p>
            </div>

            <div>
              <Label>Project Date</Label>
              {/* Always saved as a full date so projects from the same month sort by day */}
              <SingleDatePicker
                value={formData.project_date}
                onChange={(value) => setFormData(prev => ({ ...prev, project_date: value }))}
                placeholder="Select project date"
                dateFormat="full"
                showFormatSelector={false}
              />
              <div className="mt-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Display on site</Label>
                <Select
                  value={formData.date_display}
                  onValueChange={(value: 'month' | 'full') => setFormData(prev => ({ ...prev, date_display: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select display" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Month &amp; Year only (e.g., Oct 2026)</SelectItem>
                    <SelectItem value="full">Full date (e.g., 15 Oct 2026)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The full date is used for ordering; this only changes what visitors see.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {mode === 'creative' ? (
                <RichTextEditor
                  id="description"
                  value={formData.description}
                  onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                  placeholder="Describe your project... Use formatting for emphasis"
                />
              ) : (
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your project..."
                  rows={3}
                  required
                />
              )}
              <DescriptionGenerator
                entityType="project"
                mode={mode}
                data={{
                  title: formData.title,
                  category: formData.category,
                  categories: formData.categories,
                  tags: formData.tags,
                  positions: formData.positions,
                  date: formData.project_date,
                  images: formData.image_drive_id 
                    ? [generateDriveImageUrl(formData.image_drive_id, 'medium')]
                    : formData.gallery_images?.slice(0, 3),
                }}
                onGenerated={(description) => setFormData(prev => ({ ...prev, description }))}
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
                  {formData.image_scroll_enabled && (
                    <div className="pt-2 space-y-2">
                      <Label className="text-sm">Scroll Speed: {(formData.scroll_speed / 1000).toFixed(1)}s</Label>
                      <input
                        type="range"
                        min={2000}
                        max={20000}
                        step={500}
                        value={formData.scroll_speed}
                        onChange={(e) => setFormData(prev => ({ ...prev, scroll_speed: parseInt(e.target.value) }))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Fast (2s)</span>
                        <span>Slow (20s)</span>
                      </div>
                    </div>
                  )}
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
              onOpenFilePicker={(target) => openFilePicker(target, false)}
              onOpenMultiFilePicker={() => openFilePicker('gallery', true)}
            />

            {/* Media Folders - Only show when editing existing project */}
            {project && (
              <ProjectImageFolderManager projectId={project.id} />
            )}

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

            {/* Show in Recent Work Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="show_in_recent"
                checked={formData.show_in_recent}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_in_recent: checked }))}
              />
              <Label htmlFor="show_in_recent">Show in Home Page "Recent Work"</Label>
            </div>

            {/* Active/Inactive Toggle */}
            <div className="flex items-center space-x-2 p-3 rounded-lg border border-border bg-muted/30">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active" className="flex items-center gap-2">
                {formData.is_active ? (
                  <>
                    <Eye className="w-4 h-4 text-green-500" />
                    <span>Project is Active (visible to public)</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                    <span>Project is Inactive (hidden from public)</span>
                  </>
                )}
              </Label>
            </div>

            {/* Project Links Section */}
            <div className="space-y-3 border border-border rounded-lg p-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Project Links
              </Label>
              <p className="text-xs text-muted-foreground">
                Add custom links with custom button text. Check "Show on card" for the link to appear on project cards.
              </p>
              
              {/* Existing links */}
              {formData.project_links.map((link, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <Badge variant={link.show_on_card ? "default" : "secondary"} className="text-xs">
                    {link.show_on_card ? "Card" : "Detail"}
                  </Badge>
                  <span className="font-medium text-sm">{link.label}</span>
                  <span className="text-xs text-muted-foreground truncate flex-1">{link.url}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        project_links: prev.project_links.filter((_, i) => i !== index)
                      }));
                    }}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
              
              {/* Add new link */}
              <div className="pt-2 border-t">
                <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                  <Input
                    placeholder="Button label"
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                  />
                  <Input
                    placeholder="URL"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                  />
                  <div 
                    className="flex items-center gap-1.5 px-2"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      id="show_on_card"
                      checked={newLinkShowOnCard}
                      onCheckedChange={(checked) => {
                        setNewLinkShowOnCard(!!checked);
                      }}
                    />
                    <Label 
                      htmlFor="show_on_card" 
                      className="text-xs whitespace-nowrap cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      On card
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (newLinkLabel && newLinkUrl) {
                        setFormData(prev => ({
                          ...prev,
                          project_links: [...prev.project_links, { label: newLinkLabel, url: newLinkUrl, show_on_card: newLinkShowOnCard }]
                        }));
                        setNewLinkLabel('');
                        setNewLinkUrl('');
                        setNewLinkShowOnCard(false);
                      }
                    }}
                    disabled={!newLinkLabel || !newLinkUrl}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Sticky Footer */}
        <div className="flex justify-end space-x-4 bg-background px-6 py-4 border-t flex-shrink-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" disabled={loading}>
            {loading ? 'Saving...' : project ? 'Update Project' : 'Add Project'}
          </Button>
        </div>
      </div>

      {/* File Picker Dialog - Always mounted, visibility controlled by open state */}
      <Dialog open={showFilePicker} onOpenChange={(open) => {
        if (!open) {
          setShowFilePicker(false);
          setMultiSelectMode(false);
        }
      }}>
        <DialogContent 
          className="max-w-4xl max-h-[90vh] p-0 overflow-hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Select File from Google Drive</DialogTitle>
          <GoogleDriveFilePicker
            onSelect={handleFileSelect}
            onSelectMultiple={multiSelectMode ? handleMultiFileSelect : undefined}
            onCancel={() => {
              setShowFilePicker(false);
              setMultiSelectMode(false);
            }}
            selectedFileId={filePickerTarget === 'main' ? formData.image_drive_id : undefined}
            fileTypes={getFileTypesForPicker()}
            multiSelect={multiSelectMode}
            initialFolderId={lastFolderId}
            initialNavigationStack={lastNavStack}
            onNavigationChange={handleNavigationChange}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProjectForm;
