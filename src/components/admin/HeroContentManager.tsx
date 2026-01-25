
import React, { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateHeroContent, useHeroContent, useUpdateHeroContent } from '@/hooks/useHeroContent';
import { toast } from 'sonner';
import { Plus, Trash2, Eye, GripVertical } from 'lucide-react';
import TypewriterText from '@/components/TypewriterText';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const heroContentSchema = z.object({
  mode: z.enum(['professional', 'creative']),
  greeting: z.string().min(1, 'Greeting is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  cta_text: z.string().min(1, 'CTA text is required'),
  cta_link: z.string().optional(),
  order_index: z.number().min(0),
  animated_titles: z.array(z.object({
    text: z.string().min(1, 'Title text is required')
  })).min(1, 'At least one designation is required'),
  profile_photo_url: z.string().url().optional().or(z.literal('')),
  animation_speed: z.number().min(30).max(500).optional(),
  animation_pause_duration: z.number().min(500).max(5000).optional(),
  gradient_overlay_opacity: z.number().min(0).max(1).optional(),
});

type HeroContentFormData = z.infer<typeof heroContentSchema>;

// Sortable title item component
interface SortableTitleItemProps {
  id: string;
  index: number;
  form: any;
  onRemove: () => void;
}

const SortableTitleItem = ({ id, index, form, onRemove }: SortableTitleItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 items-end">
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing p-2 text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <FormField
        control={form.control}
        name={`animated_titles.${index}.text`}
        render={({ field }) => (
          <FormItem className="flex-1">
            <FormControl>
              <Input 
                placeholder="e.g., Full Stack Developer" 
                {...field} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

const HeroContentManager = () => {
  const { mode } = usePortfolio(); // Use mode from Navigation context
  const [showPreview, setShowPreview] = useState(false);
  const { data: existingContent = [] } = useHeroContent(mode);
  const existingHeroContent = existingContent[0]; // Get first entry for this mode
  const createHeroContent = useCreateHeroContent();
  const updateHeroContent = useUpdateHeroContent();

  const form = useForm<HeroContentFormData>({
    resolver: zodResolver(heroContentSchema),
    defaultValues: {
      mode: mode,
      greeting: '',
      name: '',
      description: '',
      cta_text: '',
      cta_link: '/projects',
      order_index: 0,
      animated_titles: mode === 'professional' 
        ? [
            { text: 'Full Stack Developer' },
            { text: 'Software Engineer' },
            { text: 'Web Developer' },
            { text: 'Backend Specialist' }
          ]
        : [
            { text: 'Creative Designer' },
            { text: 'Content Creator' },
            { text: 'Visual Artist' },
            { text: 'UI/UX Designer' }
          ],
      profile_photo_url: '',
      animation_speed: 100,
      animation_pause_duration: 1500,
      gradient_overlay_opacity: 0.7,
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "animated_titles"
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex(f => f.id === active.id);
      const newIndex = fields.findIndex(f => f.id === over.id);
      move(oldIndex, newIndex);
    }
  };

  // Update form mode when mode changes
  useEffect(() => {
    form.setValue('mode', mode);
  }, [mode, form]);

  // Load existing content when it's available - use a ref to prevent re-loading after updates
  const lastContentIdRef = useRef<string | null>(null);
  const isSubmittingRef = useRef(false);
  const hasLoadedRef = useRef(false); // Track if we've already loaded content for this ID
  
  useEffect(() => {
    // Don't load if we just submitted (to prevent form from resetting with stale data)
    if (isSubmittingRef.current) {
      return;
    }
    
    // Only load if:
    // 1. Content exists AND
    // 2. The ID is different from what we last loaded (new content or mode switch) OR
    // 3. We haven't loaded anything yet for this ID
    if (existingHeroContent) {
      const isNewContent = existingHeroContent.id !== lastContentIdRef.current;
      if (isNewContent || !hasLoadedRef.current) {
        lastContentIdRef.current = existingHeroContent.id;
        hasLoadedRef.current = true;
        form.reset({
          mode: existingHeroContent.mode,
          greeting: existingHeroContent.greeting,
          name: existingHeroContent.name,
          description: existingHeroContent.description,
          cta_text: existingHeroContent.cta_text,
          cta_link: (existingHeroContent as any).cta_link || '/projects',
          order_index: existingHeroContent.order_index,
          animated_titles: existingHeroContent.animated_titles && existingHeroContent.animated_titles.length > 0
            ? existingHeroContent.animated_titles.map(text => ({ text }))
            : mode === 'professional' 
              ? [{ text: 'Full Stack Developer' }, { text: 'Software Engineer' }, { text: 'Web Developer' }, { text: 'Backend Specialist' }]
              : [{ text: 'Creative Designer' }, { text: 'Content Creator' }, { text: 'Visual Artist' }, { text: 'UI/UX Designer' }],
          profile_photo_url: existingHeroContent.profile_photo_url || '',
          animation_speed: existingHeroContent.animation_speed || 100,
          animation_pause_duration: existingHeroContent.animation_pause_duration || 1500,
          gradient_overlay_opacity: existingHeroContent.gradient_overlay_opacity || 0.7,
        });
      }
    } else if (!existingHeroContent && lastContentIdRef.current !== null) {
      // Reset when switching modes with no content
      lastContentIdRef.current = null;
      hasLoadedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingHeroContent?.id, mode]);

  const onSubmit = async (data: HeroContentFormData) => {
    isSubmittingRef.current = true; // Set flag to prevent form from auto-loading
    
    try {
      const contentData = {
        mode: data.mode,
        greeting: data.greeting,
        name: data.name,
        description: data.description,
        cta_text: data.cta_text,
        cta_link: data.cta_link || '/projects',
        order_index: data.order_index,
        animated_titles: data.animated_titles?.map(item => item.text) || [],
        profile_photo_url: data.profile_photo_url && data.profile_photo_url.trim() !== '' ? data.profile_photo_url : null,
        title: (data.animated_titles && data.animated_titles.length > 0 && data.animated_titles[0].text) 
          ? data.animated_titles[0].text 
          : data.name || 'Your Designation', // Use first animated title, or name, or fallback
        background_image_url: null, // Remove background image feature
        animation_speed: data.animation_speed || 100,
        animation_pause_duration: data.animation_pause_duration || 1500,
        gradient_overlay_opacity: data.gradient_overlay_opacity || 0.7,
      };

      if (existingHeroContent) {
        // Update existing content
        await updateHeroContent.mutateAsync({
          id: existingHeroContent.id,
          ...contentData,
        });
        toast.success('Hero content updated successfully');
        // Update the refs to prevent auto-reload from overwriting form
        lastContentIdRef.current = existingHeroContent.id;
        hasLoadedRef.current = true; // Mark as loaded so useEffect won't overwrite
        // Keep the form values as they are - don't reset, just prevent the useEffect from overwriting
        // The form already has the correct values that the user entered
      } else {
        // Create new content
        const newContent = await createHeroContent.mutateAsync(contentData);
        toast.success('Hero content created successfully');
        // Update ref with new content id
        if (newContent?.id) {
          lastContentIdRef.current = newContent.id;
        }
        // Reset form to defaults for creating another entry
        const defaultTitles = mode === 'professional' 
          ? [
              { text: 'Full Stack Developer' },
              { text: 'Software Engineer' },
              { text: 'Web Developer' },
              { text: 'Backend Specialist' }
            ]
          : [
              { text: 'Creative Designer' },
              { text: 'Content Creator' },
              { text: 'Visual Artist' },
              { text: 'UI/UX Designer' }
            ];

        form.reset({
          mode: mode,
          greeting: '',
          name: '',
          description: '',
          cta_text: '',
          cta_link: '/projects',
          order_index: 0,
          animated_titles: defaultTitles,
          profile_photo_url: '',
          animation_speed: 100,
          animation_pause_duration: 1500,
          gradient_overlay_opacity: 0.7,
        });
      }
      
      // Reset the submitting flag after a delay to allow query to update
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1000);
    } catch (error) {
      isSubmittingRef.current = false; // Reset flag on error
      const errorMessage = error instanceof Error ? error.message : 'Failed to save hero content';
      toast.error(errorMessage);
      console.error('Error saving hero content:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Hero Content Management</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Editing content for <strong className="capitalize">{mode}</strong> mode. Use the mode toggle button (bottom left) to switch modes.
          </p>
        </div>
      </div>

      {/* Hero Content Form */}
      <Card>
        <CardHeader>
          <CardTitle>{existingHeroContent ? 'Edit Hero Content' : 'Create Hero Content'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="greeting"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Greeting</FormLabel>
                    <FormControl>
                      <Input placeholder="Hello, I'm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Profile Photo */}
              <FormField
                control={form.control}
                name="profile_photo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Photo URL</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://example.com/profile.jpg" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Photo will appear next to your name with floating animation
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief description..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cta_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CTA Button Text</FormLabel>
                    <FormControl>
                      <Input placeholder="View My Work" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cta_link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CTA Button Destination</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || '/projects'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination page" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mode === 'professional' ? (
                          <>
                            <SelectItem value="/projects">Projects</SelectItem>
                            <SelectItem value="/experience">Experience</SelectItem>
                            <SelectItem value="/academic">Academic</SelectItem>
                            <SelectItem value="/contact">Contact</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="/projects">Projects</SelectItem>
                            <SelectItem value="/experience">Experience</SelectItem>
                            <SelectItem value="/podcast">Podcast</SelectItem>
                            <SelectItem value="/contact">Contact</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="order_index"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Index</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Animated Titles Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Animated Titles (Typewriter Effect)</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ text: '' })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Title
                  </Button>
                </div>
                
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={fields.map(f => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {fields.map((field, index) => (
                      <SortableTitleItem
                        key={field.id}
                        id={field.id}
                        index={index}
                        form={form}
                        onRemove={() => remove(index)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>

              {/* Animation Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="animation_speed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Animation Speed (ms)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="50"
                          max="500"
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 100)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="animation_pause_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pause Duration (ms)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="500"
                          max="5000"
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1500)}
                          value={field.value || 1500}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gradient_overlay_opacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overlay Opacity</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0"
                          max="1"
                          step="0.1"
                          {...field} 
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0.7)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Preview Section */}
              {fields.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <FormLabel>Typewriter Preview</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {showPreview ? 'Hide' : 'Show'} Preview
                    </Button>
                  </div>
                  
                  {showPreview && (
                    <div className="p-4 bg-gray-900 rounded-lg">
                      <div className="text-2xl text-gray-300 font-mono">
                        <TypewriterText 
                          texts={fields.map(f => form.getValues(`animated_titles.${fields.indexOf(f)}.text`)).filter(Boolean)}
                          speed={form.watch('animation_speed') || 100}
                          pauseDuration={form.watch('animation_pause_duration') || 1500}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button type="submit" disabled={createHeroContent.isPending || updateHeroContent.isPending}>
                {(createHeroContent.isPending || updateHeroContent.isPending) ? 'Saving...' : existingHeroContent ? 'Update Hero Content' : 'Create Hero Content'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default HeroContentManager;
