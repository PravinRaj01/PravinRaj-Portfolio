import React, { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Star, Home, Image } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Project } from '@/types/cms';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { useProjects } from '@/hooks/useProjects';
import { toast } from 'sonner';

interface SortableRecentItemProps {
  project: Project;
  onToggle: (id: string, value: boolean) => void;
  onToggleFeatured: (id: string, value: boolean) => void;
}

const SortableRecentItem = ({ project, onToggle, onToggleFeatured }: SortableRecentItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 border rounded-lg bg-card",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>

      {project.image_drive_id ? (
        <img
          src={project.image_drive_id.startsWith('http')
            ? project.image_drive_id
            : generateDriveImageUrl(project.image_drive_id, 'medium')}
          alt={project.title}
          className="w-12 h-8 object-cover rounded"
        />
      ) : (
        <div className="w-12 h-8 bg-muted rounded flex items-center justify-center">
          <Image className="w-4 h-4 text-muted-foreground" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{project.title}</p>
        <p className="text-xs text-muted-foreground truncate">{project.category}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Star className={cn("w-3 h-3", project.featured ? "text-primary" : "text-muted-foreground")} />
          <Switch
            checked={project.featured}
            onCheckedChange={(checked) => onToggleFeatured(project.id, checked)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Home className="w-3 h-3 text-muted-foreground" />
          <Switch
            checked={project.show_in_recent !== false}
            onCheckedChange={(checked) => onToggle(project.id, checked)}
          />
        </div>
      </div>
    </div>
  );
};

interface ProjectFilterViewsProps {
  projects: Project[];
  viewFilter: 'all' | 'featured' | 'recent';
  mode: 'professional' | 'creative';
  onRefetch: () => void;
}

const ProjectFilterViews = ({ projects, viewFilter, mode, onRefetch }: ProjectFilterViewsProps) => {
  const { updateProject } = useProjects(mode, { includeInactive: true });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleToggleRecent = async (id: string, value: boolean) => {
    try {
      await updateProject(id, { show_in_recent: value });
      onRefetch();
      toast.success(value ? 'Added to Recent Work' : 'Removed from Recent Work');
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleToggleFeatured = async (id: string, value: boolean) => {
    try {
      await updateProject(id, { featured: value });
      onRefetch();
      toast.success(value ? 'Marked as Featured' : 'Removed from Featured');
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const recentProjects = projects
      .filter(p => p.show_in_recent !== false)
      .sort((a, b) => (a.recent_order_index || 0) - (b.recent_order_index || 0));

    const oldIndex = recentProjects.findIndex(p => p.id === active.id);
    const newIndex = recentProjects.findIndex(p => p.id === over.id);
    const newOrder = arrayMove(recentProjects, oldIndex, newIndex);

    try {
      await Promise.all(
        newOrder.map((project, idx) =>
          updateProject(project.id, { recent_order_index: idx })
        )
      );
      onRefetch();
    } catch {
      toast.error('Failed to reorder');
    }
  }, [projects, updateProject, onRefetch]);

  if (viewFilter === 'featured') {
    const featuredProjects = projects.filter(p => p.featured);
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {featuredProjects.length} featured project{featuredProjects.length !== 1 ? 's' : ''}
        </p>
        {featuredProjects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No featured projects yet.</p>
            <p className="text-xs mt-1">Toggle the star on any project to feature it.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {featuredProjects.map((project) => (
              <div key={project.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                {project.image_drive_id ? (
                  <img
                    src={project.image_drive_id.startsWith('http')
                      ? project.image_drive_id
                      : generateDriveImageUrl(project.image_drive_id, 'medium')}
                    alt={project.title}
                    className="w-12 h-8 object-cover rounded"
                  />
                ) : (
                  <div className="w-12 h-8 bg-muted rounded flex items-center justify-center">
                    <Image className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{project.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{project.category}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-primary" />
                  <Switch
                    checked={true}
                    onCheckedChange={(checked) => handleToggleFeatured(project.id, checked)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (viewFilter === 'recent') {
    const recentProjects = projects
      .filter(p => p.show_in_recent !== false)
      .sort((a, b) => (a.recent_order_index || 0) - (b.recent_order_index || 0));

    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {recentProjects.length} project{recentProjects.length !== 1 ? 's' : ''} in Recent Work — drag to reorder
        </p>
        {recentProjects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <Home className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent work projects.</p>
            <p className="text-xs mt-1">Toggle "Show in Recent" on any project.</p>
          </div>
        ) : (
          <div onPointerDown={(e) => e.stopPropagation()}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={recentProjects.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {recentProjects.map((project) => (
                    <SortableRecentItem
                      key={project.id}
                      project={project}
                      onToggle={handleToggleRecent}
                      onToggleFeatured={handleToggleFeatured}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default ProjectFilterViews;
