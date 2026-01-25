import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSiteSettings, useUpdateSiteSettings } from '@/hooks/useSiteSettings';
import { toast } from 'sonner';
import { LayoutGrid, List } from 'lucide-react';

const viewSettingsSchema = z.object({
  academic_default_view: z.enum(['timeline', 'cards']),
  projects_default_view: z.enum(['timeline', 'cards']),
});

type ViewSettingsFormData = z.infer<typeof viewSettingsSchema>;

const ViewSettingsManager = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();

  const form = useForm<ViewSettingsFormData>({
    resolver: zodResolver(viewSettingsSchema),
    defaultValues: {
      academic_default_view: settings?.academic_default_view || 'cards',
      projects_default_view: settings?.projects_default_view || 'cards',
    },
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        academic_default_view: settings.academic_default_view || 'cards',
        projects_default_view: settings.projects_default_view || 'cards',
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: ViewSettingsFormData) => {
    try {
      await updateSettings.mutateAsync({
        site_name: settings?.site_name || 'Portfolio',
        ...data,
      });
      toast.success('View settings updated successfully');
    } catch (error) {
      toast.error('Failed to update view settings');
      console.error('Error updating view settings:', error);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5" />
          Default View Settings
        </CardTitle>
        <CardDescription>
          Set the default view mode for pages that support both Timeline and Cards views
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="academic_default_view"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Academic Page Default View</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select default view" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="timeline">
                        <div className="flex items-center gap-2">
                          <List className="h-4 w-4" />
                          Timeline
                        </div>
                      </SelectItem>
                      <SelectItem value="cards">
                        <div className="flex items-center gap-2">
                          <LayoutGrid className="h-4 w-4" />
                          Cards
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose the default view for Education & Certifications page
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projects_default_view"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projects Page Default View</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select default view" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="timeline">
                        <div className="flex items-center gap-2">
                          <List className="h-4 w-4" />
                          Timeline
                        </div>
                      </SelectItem>
                      <SelectItem value="cards">
                        <div className="flex items-center gap-2">
                          <LayoutGrid className="h-4 w-4" />
                          Cards
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose the default view for the Projects page
                  </FormDescription>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? 'Saving...' : 'Save View Settings'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ViewSettingsManager;
