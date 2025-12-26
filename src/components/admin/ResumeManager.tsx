
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSiteSettings, useUpdateSiteSettings } from '@/hooks/useSiteSettings';
import { supabase } from '@/utils/supabase';
import { toast } from 'sonner';
import { Upload, FileText, Download, Trash2, Link, File, RefreshCw } from 'lucide-react';

const resumeSchema = z.object({
  resume_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

type ResumeFormData = z.infer<typeof resumeSchema>;

const ResumeManager = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const form = useForm<ResumeFormData>({
    resolver: zodResolver(resumeSchema),
    defaultValues: {
      resume_url: settings?.resume_url || '',
    },
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        resume_url: settings.resume_url || '',
      });
    }
  }, [settings, form]);

  const saveResumeUrl = async (resumeUrl: string) => {
    try {
      console.log('ResumeManager - Saving resume URL:', resumeUrl);
      const settingsData = {
        site_name: settings?.site_name || 'Portfolio',
        logo_url: settings?.logo_url,
        resume_url: resumeUrl || undefined,
      };
      
      await updateSettings.mutateAsync(settingsData);
      
      // Force immediate cache update and refetch
      console.log('ResumeManager - Forcing cache refresh...');
      await queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      await queryClient.refetchQueries({ queryKey: ['site-settings'] });
      
      // Small delay to ensure cache propagation
      setTimeout(() => {
        console.log('ResumeManager - Cache should be updated now');
      }, 100);
      
      return true;
    } catch (error) {
      console.error('ResumeManager - Error saving resume URL:', error);
      return false;
    }
  };

  const onSubmit = async (data: ResumeFormData) => {
    const success = await saveResumeUrl(data.resume_url || '');
    if (success) {
      toast.success('Resume URL updated successfully - Navigation should update shortly');
    } else {
      toast.error('Failed to update resume URL');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Delete existing resume file if it exists
      if (settings?.resume_url && settings.resume_url.includes('supabase')) {
        const oldFileName = settings.resume_url.split('/').pop();
        if (oldFileName) {
          await supabase.storage.from('resumes').remove([oldFileName]);
        }
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `resume-${Date.now()}.${fileExt}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('resumes')
        .getPublicUrl(fileName);

      if (!urlData.publicUrl) throw new Error('Failed to get public URL');

      console.log('ResumeManager - File uploaded, saving URL:', urlData.publicUrl);

      // Save the resume URL to the database
      const success = await saveResumeUrl(urlData.publicUrl);
      
      if (success) {
        form.reset({ resume_url: urlData.publicUrl });
        toast.success('Resume uploaded and saved successfully - Check the navigation!');
      } else {
        throw new Error('Failed to save resume URL');
      }
    } catch (error) {
      toast.error('Failed to upload resume');
      console.error('Error uploading resume:', error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleRemoveResume = async () => {
    if (confirm('Are you sure you want to remove the resume?')) {
      try {
        // Delete file from storage if it's hosted on Supabase
        if (settings?.resume_url && settings.resume_url.includes('supabase')) {
          const fileName = settings.resume_url.split('/').pop();
          if (fileName) {
            await supabase.storage.from('resumes').remove([fileName]);
          }
        }

        const success = await saveResumeUrl('');
        if (success) {
          form.reset({ resume_url: '' });
          toast.success('Resume removed successfully');
        } else {
          throw new Error('Failed to remove resume from database');
        }
      } catch (error) {
        toast.error('Failed to remove resume');
        console.error('Error removing resume:', error);
      }
    }
  };

  const handleRefresh = async () => {
    console.log('ResumeManager - Manual refresh triggered');
    await queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    await queryClient.refetchQueries({ queryKey: ['site-settings'] });
    toast.success('Settings refreshed');
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Resume Management
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="ml-auto"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <File className="w-4 h-4" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link className="w-4 h-4" />
              Use URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="resume-upload"
                  disabled={uploading}
                />
                <label htmlFor="resume-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center space-y-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {uploading ? 'Uploading...' : 'Upload Resume PDF'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Click to select or drag and drop (Max 10MB)
                      </p>
                    </div>
                  </div>
                </label>
              </div>
              
              {uploading && (
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="resume_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resume URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/resume.pdf" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? 'Saving...' : 'Save Resume URL'}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>

        {settings?.resume_url && (
          <div className="flex gap-4 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => window.open(settings.resume_url, '_blank')}
            >
              <Download className="w-4 h-4 mr-2" />
              Preview Resume
            </Button>
            
            <Button 
              variant="destructive" 
              onClick={handleRemoveResume}
              disabled={updateSettings.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Resume
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResumeManager;
