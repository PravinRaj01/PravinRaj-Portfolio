
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { Education } from '@/types/academic';
import { useCreateEducation, useUpdateEducation } from '@/hooks/useEducation';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/ui/date-range-picker';

const educationSchema = z.object({
  degree: z.string().min(1, 'Degree is required'),
  institution: z.string().min(1, 'Institution is required'),
  location: z.string().min(1, 'Location is required'),
  period: z.string().min(1, 'Period is required'),
  description: z.string().min(1, 'Description is required'),
  achievements: z.array(z.string()).min(1, 'At least one achievement is required'),
  order_index: z.number().min(0),
});

type EducationFormData = z.infer<typeof educationSchema>;

interface EducationFormProps {
  education?: Education;
  onSuccess: () => void;
  onCancel: () => void;
}

const EducationForm = ({ education, onSuccess, onCancel }: EducationFormProps) => {
  const [newAchievement, setNewAchievement] = useState('');
  const createEducation = useCreateEducation();
  const updateEducation = useUpdateEducation();

  const form = useForm<EducationFormData>({
    resolver: zodResolver(educationSchema),
    defaultValues: {
      degree: education?.degree || '',
      institution: education?.institution || '',
      location: education?.location || '',
      period: education?.period || '',
      description: education?.description || '',
      achievements: education?.achievements || [],
      order_index: education?.order_index || 0,
    },
  });

  const onSubmit = async (data: EducationFormData) => {
    try {
      // Ensure all required fields are present
      const educationData: Omit<Education, 'id' | 'created_at' | 'updated_at'> = {
        degree: data.degree,
        institution: data.institution,
        location: data.location,
        period: data.period,
        description: data.description,
        achievements: data.achievements,
        order_index: data.order_index,
      };

      if (education) {
        await updateEducation.mutateAsync({ id: education.id, ...educationData });
        toast.success('Education updated successfully');
      } else {
        await createEducation.mutateAsync(educationData);
        toast.success('Education created successfully');
      }
      onSuccess();
    } catch (error) {
      toast.error('Failed to save education');
      console.error('Error saving education:', error);
    }
  };

  const addAchievement = () => {
    if (newAchievement.trim()) {
      const currentAchievements = form.getValues('achievements');
      form.setValue('achievements', [...currentAchievements, newAchievement.trim()]);
      setNewAchievement('');
    }
  };

  const removeAchievement = (index: number) => {
    const currentAchievements = form.getValues('achievements');
    form.setValue('achievements', currentAchievements.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{education ? 'Edit Education' : 'Add Education'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="degree"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Degree</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Master of Science in Computer Science" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="institution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Institution</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Tech University" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., San Francisco, CA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period</FormLabel>
                  <FormControl>
                    <DateRangePicker
                      value={field.value}
                      onChange={field.onChange}
                      allowPresent={true}
                    />
                  </FormControl>
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
                    <Textarea placeholder="Description of your education..." rows={3} {...field} />
                  </FormControl>
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
                      placeholder="0" 
                      {...field} 
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel>Achievements</FormLabel>
              <div className="flex gap-2">
                <Input
                  placeholder="Add achievement..."
                  value={newAchievement}
                  onChange={(e) => setNewAchievement(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAchievement())}
                />
                <Button type="button" onClick={addAchievement} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.watch('achievements').map((achievement, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {achievement}
                    <button
                      type="button"
                      onClick={() => removeAchievement(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              {form.formState.errors.achievements && (
                <p className="text-sm text-destructive">{form.formState.errors.achievements.message}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={createEducation.isPending || updateEducation.isPending}
              >
                {education ? 'Update' : 'Create'} Education
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default EducationForm;
