import React, { useState, useCallback, useMemo } from 'react';
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
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { X, Image, Video, Plus, GripVertical, Play, Images } from 'lucide-react';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { cn } from '@/lib/utils';
import { ProjectImageFolder } from '@/types/cms';

export type MediaType = 'none' | 'images' | 'video' | 'both';

// Video entries in images array use format: video::driveFileId::thumbnailUrl
const VIDEO_PREFIX = 'video::';

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  originalValue: string; // The raw value stored in images array
}

interface FolderMediaManagerProps {
  folder: ProjectImageFolder;
  onUpdate: (id: string, updates: Partial<ProjectImageFolder>) => Promise<void>;
  onOpenFilePicker: (target: 'image' | 'video' | 'thumbnail') => void;
  onOpenMultiFilePicker: () => void;
}

interface SortableMediaItemProps {
  item: MediaItem;
  onRemove: () => void;
}

// Parse video entry: video::fileId::thumbnailUrl
const parseVideoEntry = (entry: string): { fileId: string; thumbnailUrl: string } | null => {
  if (!entry.startsWith(VIDEO_PREFIX)) return null;
  const parts = entry.slice(VIDEO_PREFIX.length).split('::');
  return {
    fileId: parts[0] || '',
    thumbnailUrl: parts[1] || ''
  };
};

// Create video entry string
export const createVideoEntry = (fileId: string, thumbnailUrl: string = ''): string => {
  return `${VIDEO_PREFIX}${fileId}::${thumbnailUrl}`;
};

// Check if entry is a video
export const isVideoEntry = (entry: string): boolean => {
  return entry.startsWith(VIDEO_PREFIX);
};

const SortableMediaItem = ({ item, onRemove }: SortableMediaItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const thumbnailUrl = item.type === 'video' 
    ? (item.thumbnailUrl || '/placeholder.svg')
    : item.url;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group bg-card border rounded-lg overflow-hidden",
        isDragging && "opacity-50 z-50 shadow-lg"
      )}
    >
      <div className="aspect-video relative">
        <img
          src={thumbnailUrl}
          alt={item.type === 'video' ? 'Video thumbnail' : 'Gallery image'}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder.svg';
          }}
        />
        
        {/* Video overlay */}
        {item.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center">
              <Play className="w-4 h-4 text-primary-foreground ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}

        {/* Type badge */}
        <div className={cn(
          "absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-medium rounded",
          item.type === 'video' 
            ? "bg-purple-500 text-white" 
            : "bg-blue-500 text-white"
        )}>
          {item.type === 'video' ? 'VIDEO' : 'IMAGE'}
        </div>

        {/* Drag handle */}
        <button type="button"
          {...attributes}
          {...listeners}
          className="absolute top-1 right-8 p-1 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-3 h-3 text-white" />
        </button>

        {/* Remove button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 p-1 bg-destructive rounded opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
    </div>
  );
};

const FolderMediaManager = ({
  folder,
  onUpdate,
  onOpenFilePicker,
  onOpenMultiFilePicker,
}: FolderMediaManagerProps) => {
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');

  const mediaType = folder.media_type || 'images';
  const images = folder.images || [];

  // Create combined media items for display - now supports multiple videos inline
  const mediaItems = useMemo((): MediaItem[] => {
    const items: MediaItem[] = [];
    
    if (mediaType === 'none') return items;
    
    images.forEach((entry, index) => {
      const videoData = parseVideoEntry(entry);
      
      if (videoData) {
        // This is a video entry
        if (mediaType === 'both' || mediaType === 'video') {
          const videoEmbedUrl = `https://drive.google.com/file/d/${videoData.fileId}/preview`;
          items.push({
            id: `video-${index}`,
            type: 'video',
            url: videoEmbedUrl,
            thumbnailUrl: videoData.thumbnailUrl || undefined,
            originalValue: entry
          });
        }
      } else {
        // This is an image entry
        if (mediaType === 'both' || mediaType === 'images') {
          items.push({
            id: `image-${index}`,
            type: 'image',
            url: entry.startsWith('http') ? entry : generateDriveImageUrl(entry, 'small'),
            originalValue: entry
          });
        }
      }
    });
    
    return items;
  }, [images, mediaType]);

  // Count videos and images
  const videoCount = images.filter(img => isVideoEntry(img)).length;
  const imageCount = images.filter(img => !isVideoEntry(img)).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = mediaItems.findIndex(item => item.id === active.id);
    const newIndex = mediaItems.findIndex(item => item.id === over.id);
    const newItems = arrayMove(mediaItems, oldIndex, newIndex);
    
    // Rebuild images array preserving original values
    const newImages = newItems.map(item => item.originalValue);
    
    await onUpdate(folder.id, { images: newImages });
  }, [mediaItems, folder.id, onUpdate]);

  const handleRemoveItem = useCallback(async (itemId: string) => {
    const item = mediaItems.find(m => m.id === itemId);
    if (!item) return;
    
    const newImages = images.filter(img => img !== item.originalValue);
    await onUpdate(folder.id, { images: newImages });
  }, [mediaItems, images, folder.id, onUpdate]);

  const handleAddImage = useCallback(async () => {
    if (!newImageUrl.trim()) return;
    const updatedImages = [...images, newImageUrl.trim()];
    await onUpdate(folder.id, { images: updatedImages });
    setNewImageUrl('');
  }, [newImageUrl, images, folder.id, onUpdate]);

  const handleAddVideo = useCallback(async () => {
    if (!newVideoUrl.trim()) return;
    // Extract file ID from Google Drive URL if provided
    const driveMatch = newVideoUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    const fileId = driveMatch ? driveMatch[1] : newVideoUrl.trim();
    
    const videoEntry = createVideoEntry(fileId, '');
    const updatedImages = [...images, videoEntry];
    await onUpdate(folder.id, { images: updatedImages });
    setNewVideoUrl('');
  }, [newVideoUrl, images, folder.id, onUpdate]);

  const handleMediaTypeChange = useCallback(async (value: MediaType) => {
    const updates: Partial<ProjectImageFolder> = { media_type: value };
    
    // Clear videos when switching to images-only
    if (value === 'images') {
      updates.images = images.filter(img => !isVideoEntry(img));
    }
    // Clear images when switching to video-only
    if (value === 'video') {
      updates.images = images.filter(img => isVideoEntry(img));
    }
    // Clear everything when switching to none
    if (value === 'none') {
      updates.images = [];
    }
    
    await onUpdate(folder.id, updates);
  }, [folder.id, images, onUpdate]);

  return (
    <div className="space-y-4 pt-3">
      {/* Media Type Selector */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Media Type</Label>
        <RadioGroup
          value={mediaType}
          onValueChange={(v) => handleMediaTypeChange(v as MediaType)}
          className="flex flex-wrap gap-3"
        >
          <div className="flex items-center space-x-1.5">
            <RadioGroupItem value="none" id={`media-none-${folder.id}`} />
            <Label htmlFor={`media-none-${folder.id}`} className="cursor-pointer text-xs">None</Label>
          </div>
          <div className="flex items-center space-x-1.5">
            <RadioGroupItem value="images" id={`media-images-${folder.id}`} />
            <Label htmlFor={`media-images-${folder.id}`} className="cursor-pointer text-xs flex items-center gap-1">
              <Image className="w-3 h-3" /> Images
            </Label>
          </div>
          <div className="flex items-center space-x-1.5">
            <RadioGroupItem value="video" id={`media-video-${folder.id}`} />
            <Label htmlFor={`media-video-${folder.id}`} className="cursor-pointer text-xs flex items-center gap-1">
              <Video className="w-3 h-3" /> Videos
            </Label>
          </div>
          <div className="flex items-center space-x-1.5">
            <RadioGroupItem value="both" id={`media-both-${folder.id}`} />
            <Label htmlFor={`media-both-${folder.id}`} className="cursor-pointer text-xs flex items-center gap-1">
              <Image className="w-3 h-3" />+<Video className="w-3 h-3" /> Both
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Media Grid */}
      {mediaType !== 'none' && (
        <>
          {mediaItems.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={mediaItems.map(m => m.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {mediaItems.map((item) => (
                    <SortableMediaItem
                      key={item.id}
                      item={item}
                      onRemove={() => handleRemoveItem(item.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {mediaItems.length === 0 && (
            <div className="border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground text-xs">
              No media added yet
            </div>
          )}

          {/* Add Images Section */}
          {(mediaType === 'images' || mediaType === 'both') && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-medium">Add Images ({imageCount} added)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter image URL"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddImage();
                    }
                  }}
                  className="text-xs h-8"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddImage} disabled={!newImageUrl.trim()}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenFilePicker('image')} className="text-xs h-7">
                  <Image className="w-3 h-3 mr-1" /> Add Single
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onOpenMultiFilePicker} className="text-xs h-7">
                  <Images className="w-3 h-3 mr-1" /> Add Multiple
                </Button>
              </div>
            </div>
          )}

          {/* Add Videos Section */}
          {(mediaType === 'video' || mediaType === 'both') && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-medium">Add Videos ({videoCount} added)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Google Drive video URL or file ID"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddVideo();
                    }
                  }}
                  className="text-xs h-8"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddVideo} disabled={!newVideoUrl.trim()}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenFilePicker('video')} className="text-xs h-7">
                  <Video className="w-3 h-3 mr-1" /> Add Single
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onOpenMultiFilePicker} className="text-xs h-7">
                  <Images className="w-3 h-3 mr-1" /> Add Multiple
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FolderMediaManager;
