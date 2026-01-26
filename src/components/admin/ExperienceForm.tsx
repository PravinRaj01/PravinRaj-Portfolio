import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { X, Plus, Image as ImageIcon, Award, Link as LinkIcon, GripVertical } from 'lucide-react';
import { Experience } from '@/types/cms';
import { DateRangePicker, SingleDatePicker } from '@/components/ui/date-range-picker';
import GoogleDriveFilePicker from './GoogleDriveFilePicker';
import { DriveFile } from '@/services/googleDriveService';
import { generateDriveImageUrl } from '@/utils/googleDrive';

// Sortable image item component
interface SortableImageProps {
  id: string;
  url: string;
  index: number;
  onRemove: (index: number) => void;
}

const SortableImage = ({ id, url, index, onRemove }: SortableImageProps) => {
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
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isDragging ? 'ring-2 ring-primary' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 p-1 bg-background/80 rounded cursor-grab opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <GripVertical className="w-3 h-3" />
      </div>
      <img 
        src={url} 
        alt={`Event image ${index + 1}`}
        className="w-full h-20 object-cover rounded-lg border"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/placeholder.svg';
        }}
      />
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute top-1 right-1 p-1 bg-destructive rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3 text-white" />
      </button>
    </div>
  );
};

const experienceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  company: z.string().min(1, 'Company/Organization is required'),
  location: z.string().min(1, 'Location is required'),
  period: z.string().optional(),
  event_date: z.string().optional(),
  date_type: z.enum(['single', 'range']),
  description: z.string().min(1, 'Description is required'),
  mode: z.enum(['professional', 'creative']),
  role: z.string().optional(),
  experience_type: z.enum(['job', 'event']).optional(),
});

type ExperienceFormData = z.infer<typeof experienceSchema>;

interface ExperienceFormProps {
  onSubmit: (data: ExperienceFormData & { achievements: string[]; event_images?: string[]; certificate_url?: string; certificate_drive_id?: string }) => Promise<void>;
  onCancel: () => void;
  initialData?: Experience;
  loading?: boolean;
  mode: 'professional' | 'creative';
}

const ExperienceForm = ({ onSubmit, onCancel, initialData, loading, mode }: ExperienceFormProps) => {
  const [achievements, setAchievements] = React.useState<string[]>(
    initialData?.achievements || []
  );
  const [newAchievement, setNewAchievement] = React.useState('');
  const [eventImages, setEventImages] = React.useState<string[]>(
    initialData?.event_images || []
  );
  const [newImageUrl, setNewImageUrl] = React.useState('');
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showCertPicker, setShowCertPicker] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState(initialData?.certificate_url || '');
  const [certificateDriveId, setCertificateDriveId] = useState(initialData?.certificate_drive_id || '');

  // Determine initial date type from data
  const getInitialDateType = (): 'single' | 'range' => {
    if (initialData?.date_type) return initialData.date_type as 'single' | 'range';
    if (initialData?.event_date) return 'single';
    return 'range';
  };

  const form = useForm<ExperienceFormData>({
    resolver: zodResolver(experienceSchema),
    defaultValues: {
      title: initialData?.title || '',
      company: initialData?.company || '',
      location: initialData?.location || '',
      period: initialData?.period || '',
      event_date: initialData?.event_date || '',
      date_type: getInitialDateType(),
      description: initialData?.description || '',
      mode: initialData?.mode || mode,
      role: initialData?.role || '',
      experience_type: initialData?.experience_type || (mode === 'creative' ? 'event' : 'job'),
    },
  });

  const dateType = form.watch('date_type');
  const isCreativeMode = mode === 'creative';

  const handleSubmit = async (data: ExperienceFormData) => {
    // Build final period/event_date based on date_type
    const finalData = {
      ...data,
      achievements,
      event_images: isCreativeMode ? eventImages : undefined,
      // Ensure we set the right date field
      period: data.date_type === 'range' ? data.period : '',
      event_date: data.date_type === 'single' ? data.event_date : '',
      // Certificate fields
      certificate_url: isCreativeMode ? certificateUrl : undefined,
      certificate_drive_id: isCreativeMode ? certificateDriveId : undefined,
    };
    await onSubmit(finalData);
  };

  const addAchievement = () => {
    if (newAchievement.trim()) {
      setAchievements([...achievements, newAchievement.trim()]);
      setNewAchievement('');
    }
  };

  const removeAchievement = (index: number) => {
    setAchievements(achievements.filter((_, i) => i !== index));
  };

  const addEventImage = () => {
    if (newImageUrl.trim()) {
      setEventImages([...eventImages, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const removeEventImage = (index: number) => {
    setEventImages(eventImages.filter((_, i) => i !== index));
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = eventImages.findIndex((url) => url === active.id);
      const newIndex = eventImages.findIndex((url) => url === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setEventImages(arrayMove(eventImages, oldIndex, newIndex));
      }
    }
  };

  const handleFileSelect = (file: DriveFile) => {
    const imageUrl = generateDriveImageUrl(file.id, 'large');
    setEventImages([...eventImages, imageUrl]);
    setShowFilePicker(false);
  };

  const handleMultiFileSelect = (files: DriveFile[]) => {
    const newUrls = files.map(file => generateDriveImageUrl(file.id, 'large'));
    setEventImages([...eventImages, ...newUrls]);
    setShowFilePicker(false);
  };

  const handleCertificateSelect = (file: DriveFile) => {
    setCertificateDriveId(file.id);
    setCertificateUrl(''); // Clear URL if Drive ID is set
    setShowCertPicker(false);
  };

  const removeCertificate = () => {
    setCertificateUrl('');
    setCertificateDriveId('');
  };

  const getCertificateDisplayUrl = () => {
    if (certificateDriveId) {
      return `https://drive.google.com/file/d/${certificateDriveId}/view`;
    }
    return certificateUrl;
  };

  // Show Google Drive file picker for images (multi-select enabled)
  if (showFilePicker) {
    return (
      <GoogleDriveFilePicker
        onSelect={handleFileSelect}
        onSelectMultiple={handleMultiFileSelect}
        onCancel={() => setShowFilePicker(false)}
        fileTypes={['image']}
        multiSelect={true}
      />
    );
  }

  // Show Google Drive file picker for certificate
  if (showCertPicker) {
    return (
      <GoogleDriveFilePicker
        onSelect={handleCertificateSelect}
        onCancel={() => setShowCertPicker(false)}
        fileTypes={['image', 'document']}
      />
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      {/* Sticky Header */}
      <div className="flex flex-row items-center justify-between bg-background px-6 py-4 border-b flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold">
            {initialData ? 'Edit Experience' : 'Add New Experience'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isCreativeMode 
              ? 'Add your speaking engagement, event, or creative work experience'
              : 'Add your work experience and achievements'
            }
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} type="button">
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <Form {...form}>
          <form id="experience-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isCreativeMode ? 'Event Name' : 'Job Title'}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={isCreativeMode ? 'AI Summit 2024' : 'Senior Developer'} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isCreativeMode ? 'Organization/Venue' : 'Company'}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={isCreativeMode ? 'Tech Conference Center' : 'Tech Corp'} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Role field - only for creative mode */}
              {isCreativeMode && (
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Role</FormLabel>
                      <FormControl>
                        <Input placeholder="Guest Speaker, Judge, Panelist..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="New York, NY" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date Type Selection */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="date_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="single" id="date-single" />
                          <Label htmlFor="date-single" className="cursor-pointer">Single Date</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="range" id="date-range" />
                          <Label htmlFor="date-range" className="cursor-pointer">Date Range</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conditional Date Picker */}
              {dateType === 'single' ? (
                <FormField
                  control={form.control}
                  name="event_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <SingleDatePicker
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder="Select date"
                          showFormatSelector={true}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period</FormLabel>
                      <FormControl>
                        <DateRangePicker
                          value={field.value || ''}
                          onChange={field.onChange}
                          allowPresent={true}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mode</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
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
                    {isCreativeMode ? (
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Describe your role and contributions at this event... Use formatting for emphasis"
                      />
                    ) : (
                      <Textarea 
                        placeholder="Describe your role and responsibilities..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Achievements/Highlights */}
            <div className="space-y-4">
              <Label>{isCreativeMode ? 'Highlights' : 'Achievements'}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={isCreativeMode ? "Add a highlight..." : "Add an achievement..."}
                  value={newAchievement}
                  onChange={(e) => setNewAchievement(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAchievement())}
                />
                <Button type="button" onClick={addAchievement} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {achievements.map((achievement, index) => (
                  <Badge key={index} variant="secondary" className="text-sm">
                    {achievement}
                    <button
                      type="button"
                      onClick={() => removeAchievement(index)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Event Images - Only for Creative Mode */}
            {isCreativeMode && (
              <div className="space-y-4 border-t pt-4">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Event Images (Optional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter image URL..."
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEventImage())}
                  />
                  <Button type="button" onClick={addEventImage} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilePicker(true)}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Add from Google Drive
                </Button>
                {eventImages.length > 0 && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={eventImages}
                      strategy={rectSortingStrategy}
                    >
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {eventImages.map((url, index) => (
                          <SortableImage
                            key={url}
                            id={url}
                            url={url}
                            index={index}
                            onRemove={removeEventImage}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
                <p className="text-xs text-muted-foreground">
                  Add photos from the event to showcase your participation
                </p>
              </div>
            )}

            {/* Certificate Section - Only for Creative Mode */}
            {isCreativeMode && (
              <div className="space-y-4 border-t pt-4">
                <Label className="flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Certificate (Optional)
                </Label>
                
                {/* Show current certificate if set */}
                {(certificateUrl || certificateDriveId) ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Award className="w-4 h-4 text-primary" />
                    <a 
                      href={getCertificateDisplayUrl()} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex-1 truncate"
                    >
                      {certificateDriveId ? 'Certificate (Google Drive)' : certificateUrl}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeCertificate}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter certificate URL..."
                        value={certificateUrl}
                        onChange={(e) => {
                          setCertificateUrl(e.target.value);
                          setCertificateDriveId(''); // Clear Drive ID if URL is entered
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">OR</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCertPicker(true)}
                      >
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Select from Google Drive
                      </Button>
                    </div>
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  Add a link to your certificate or award for this event
                </p>
              </div>
            )}

          </form>
        </Form>
      </div>

      {/* Sticky Footer */}
      <div className="flex justify-end space-x-4 bg-background px-6 py-4 border-t flex-shrink-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" form="experience-form" disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update Experience' : 'Add Experience'}
        </Button>
      </div>
    </div>
  );
};

export default ExperienceForm;
