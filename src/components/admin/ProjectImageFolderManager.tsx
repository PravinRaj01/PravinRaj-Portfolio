import React, { useState, useCallback } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Plus, 
  Folder, 
  GripVertical, 
  ChevronDown, 
  ChevronRight, 
  Trash2,
  Video
} from 'lucide-react';
import { useProjectImageFolders } from '@/hooks/useProjectImageFolders';
import { ProjectImageFolder } from '@/types/cms';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import GoogleDriveFilePicker from './GoogleDriveFilePicker';
import FolderMediaManager from './FolderMediaManager';
import { DriveFile } from '@/services/googleDriveService';

interface ProjectImageFolderManagerProps {
  projectId?: string;
}

interface SortableFolderItemProps {
  folder: ProjectImageFolder;
  onUpdate: (id: string, updates: Partial<ProjectImageFolder>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpenFilePicker: (folderId: string, target: 'image' | 'video' | 'thumbnail') => void;
  onOpenMultiFilePicker: (folderId: string) => void;
}

const SortableFolderItem = ({ folder, onUpdate, onDelete, onOpenFilePicker, onOpenMultiFilePicker }: SortableFolderItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description || '');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Folder name is required');
      return;
    }
    await onUpdate(folder.id, { name: name.trim(), description: description.trim() || undefined });
    setIsEditing(false);
    toast.success('Folder updated');
  };

  const handleDeleteFolder = async () => {
    if (confirm(`Delete folder "${folder.name}"? This cannot be undone.`)) {
      await onDelete(folder.id);
      toast.success('Folder deleted');
    }
  };

  // Calculate media counts
  const imageCount = folder.images?.filter(img => img !== '__VIDEO__').length || 0;
  const hasVideo = !!folder.video_url;
  const mediaType = folder.media_type || 'images';

  const getMediaBadgeText = () => {
    if (mediaType === 'none') return '0 items';
    if (mediaType === 'video' && hasVideo) return '1 video';
    if (mediaType === 'images') return `${imageCount} image${imageCount !== 1 ? 's' : ''}`;
    if (mediaType === 'both') {
      const parts = [];
      if (imageCount > 0) parts.push(`${imageCount} image${imageCount !== 1 ? 's' : ''}`);
      if (hasVideo) parts.push('1 video');
      return parts.join(', ') || '0 items';
    }
    return `${imageCount} image${imageCount !== 1 ? 's' : ''}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-lg bg-card",
        isDragging && "opacity-50 z-50 shadow-lg"
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 p-3">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>

          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 flex-1 text-left">
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <Folder className="w-4 h-4 text-orange-500" />
              <span className="font-medium">{folder.name}</span>
              <Badge variant="secondary" className="ml-2 text-xs flex items-center gap-1">
                {hasVideo && <Video className="w-3 h-3" />}
                {getMediaBadgeText()}
              </Badge>
            </button>
          </CollapsibleTrigger>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDeleteFolder}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 space-y-4 border-t">
            {/* Folder Name & Description */}
            {isEditing ? (
              <div className="space-y-3 pt-3">
                <div>
                  <Label className="text-xs">Folder Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Teaser Images"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Description (optional)</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this folder"
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleSave}>
                    Save
                  </Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      setName(folder.name);
                      setDescription(folder.description || '');
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="pt-3">
                {folder.description && (
                  <p className="text-sm text-muted-foreground mb-2">{folder.description}</p>
                )}
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditing(true)}
                >
                  Edit Details
                </Button>
              </div>
            )}

            {/* Media Manager */}
            <FolderMediaManager
              folder={folder}
              onUpdate={onUpdate}
              onOpenFilePicker={(target) => onOpenFilePicker(folder.id, target)}
              onOpenMultiFilePicker={() => onOpenMultiFilePicker(folder.id)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

const ProjectImageFolderManager = ({ projectId }: ProjectImageFolderManagerProps) => {
  const { 
    imageFolders, 
    loading, 
    addImageFolder, 
    updateImageFolder, 
    deleteImageFolder 
  } = useProjectImageFolders(projectId);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerFolderId, setFilePickerFolderId] = useState<string | null>(null);
  const [filePickerTarget, setFilePickerTarget] = useState<'image' | 'video' | 'thumbnail'>('image');
  const [isMultiSelect, setIsMultiSelect] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = imageFolders.findIndex(f => f.id === active.id);
      const newIndex = imageFolders.findIndex(f => f.id === over.id);
      
      const newOrder = arrayMove(imageFolders, oldIndex, newIndex);
      
      // Update order_index for all affected folders
      await Promise.all(
        newOrder.map((folder, idx) => 
          updateImageFolder(folder.id, { order_index: idx })
        )
      );
    }
  }, [imageFolders, updateImageFolder]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Folder name is required');
      return;
    }
    if (!projectId) {
      toast.error('Please save the project first');
      return;
    }

    try {
      await addImageFolder({
        project_id: projectId,
        name: newFolderName.trim(),
        description: newFolderDescription.trim() || undefined,
        images: [],
        order_index: imageFolders.length,
      });
      setNewFolderName('');
      setNewFolderDescription('');
      setShowNewFolder(false);
      toast.success('Folder created');
    } catch (error) {
      toast.error('Failed to create folder');
    }
  };

  const handleUpdate = async (id: string, updates: Partial<ProjectImageFolder>) => {
    try {
      await updateImageFolder(id, updates);
    } catch (error) {
      toast.error('Failed to update folder');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteImageFolder(id);
    } catch (error) {
      toast.error('Failed to delete folder');
    }
  };

  const openFilePicker = (folderId: string, target: 'image' | 'video' | 'thumbnail') => {
    setFilePickerFolderId(folderId);
    setFilePickerTarget(target);
    setIsMultiSelect(false);
    setShowFilePicker(true);
  };

  const openMultiFilePicker = (folderId: string) => {
    setFilePickerFolderId(folderId);
    setFilePickerTarget('image');
    setIsMultiSelect(true);
    setShowFilePicker(true);
  };

  const handleFileSelect = async (file: DriveFile) => {
    if (!filePickerFolderId) return;
    
    const folder = imageFolders.find(f => f.id === filePickerFolderId);
    if (!folder) return;

    if (filePickerTarget === 'video') {
      // Video file from Drive
      const videoUrl = `https://drive.google.com/file/d/${file.id}/preview`;
      await updateImageFolder(filePickerFolderId, { video_url: videoUrl });
      toast.success('Video added');
    } else if (filePickerTarget === 'thumbnail') {
      const thumbnailUrl = generateDriveImageUrl(file.id, 'large');
      await updateImageFolder(filePickerFolderId, { video_thumbnail: thumbnailUrl });
      toast.success('Thumbnail added');
    } else {
      // Image
      const imageUrl = generateDriveImageUrl(file.id, 'large');
      const updatedImages = [...(folder.images || []), imageUrl];
      await updateImageFolder(filePickerFolderId, { images: updatedImages });
      toast.success('Image added');
    }
    
    setShowFilePicker(false);
    setFilePickerFolderId(null);
  };

  const handleMultiFileSelect = async (files: DriveFile[]) => {
    if (!filePickerFolderId) return;
    
    const folder = imageFolders.find(f => f.id === filePickerFolderId);
    if (!folder) return;

    const newUrls = files.map(file => generateDriveImageUrl(file.id, 'large'));
    const updatedImages = [...(folder.images || []), ...newUrls];
    await updateImageFolder(filePickerFolderId, { images: updatedImages });
    
    setShowFilePicker(false);
    setFilePickerFolderId(null);
    toast.success(`${files.length} images added`);
  };

  if (showFilePicker) {
    return (
      <GoogleDriveFilePicker
        onSelect={handleFileSelect}
        onSelectMultiple={isMultiSelect ? handleMultiFileSelect : undefined}
        onCancel={() => {
          setShowFilePicker(false);
          setFilePickerFolderId(null);
        }}
        fileTypes={filePickerTarget === 'video' ? ['video'] : ['image']}
        multiSelect={isMultiSelect}
      />
    );
  }

  if (!projectId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-muted-foreground">
          <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Save the project first to add media subfolders.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Media Subfolders</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Organize project media into folders (e.g., Teasers, Assets, Behind the Scenes)
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowNewFolder(true)}
          disabled={showNewFolder}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Folder
        </Button>
      </div>

      {/* New Folder Form */}
      {showNewFolder && (
        <Card className="border-primary/50">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Folder className="w-4 h-4 text-orange-500" />
              New Folder
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 space-y-3">
            <div>
              <Label className="text-xs">Folder Name</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g., Teaser Images"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Textarea
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
                placeholder="Brief description of this folder"
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleCreateFolder}>
                Create Folder
              </Button>
              <Button 
                type="button" 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setShowNewFolder(false);
                  setNewFolderName('');
                  setNewFolderDescription('');
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Folders List */}
      {loading ? (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Loading folders...
        </div>
      ) : imageFolders.length === 0 && !showNewFolder ? (
        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
          <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No media folders yet.</p>
          <p className="text-xs mt-1">Click "Add Folder" to create one.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={imageFolders.map(f => f.id)} 
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {imageFolders.map((folder) => (
                <SortableFolderItem
                  key={folder.id}
                  folder={folder}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onOpenFilePicker={openFilePicker}
                  onOpenMultiFilePicker={openMultiFilePicker}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default ProjectImageFolderManager;
