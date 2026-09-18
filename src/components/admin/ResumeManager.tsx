
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSiteSettings, useUpdateSiteSettings } from '@/hooks/useSiteSettings';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { apiClient } from '@/services/apiClient';
import { toast } from 'sonner';
import { Upload, FileText, Download, Trash2, Link, File, RefreshCw, Briefcase, Palette, Copy } from 'lucide-react';

const resumeSchema = z.object({
  resume_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

type ResumeFormData = z.infer<typeof resumeSchema>;

const ResumeManager = () => {
  const { mode } = usePortfolio();
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Get the current resume URL based on mode
  const getCurrentResumeUrl = () => {
    if (mode === 'professional') {
      return settings?.professional_resume_url || '';
    }
    return settings?.creative_resume_url || '';
  };

  const form = useForm<ResumeFormData>({
    resolver: zodResolver(resumeSchema),
    defaultValues: {
      resume_url: getCurrentResumeUrl(),
    },
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        resume_url: getCurrentResumeUrl(),
      });
    }
  }, [settings, mode, form]);

  const saveResumeUrl = async (resumeUrl: string) => {
    try {
      console.log('ResumeManager - Saving resume URL for mode:', mode, 'URL:', resumeUrl);
      
      const settingsData: any = {
        site_name: settings?.site_name || 'Portfolio',
        logo_url: settings?.logo_url,
      };

      // Set the mode-specific resume URL
      if (mode === 'professional') {
        settingsData.professional_resume_url = resumeUrl || null;
      } else {
        settingsData.creative_resume_url = resumeUrl || null;
      }
      
      await updateSettings.mutateAsync(settingsData);
      
      // Force immediate cache update and refetch
      console.log('ResumeManager - Forcing cache refresh...');
      await queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      await queryClient.refetchQueries({ queryKey: ['site-settings'] });
      
      return true;
    } catch (error) {
      console.error('ResumeManager - Error saving resume URL:', error);
      return false;
    }
  };

  const onSubmit = async (data: ResumeFormData) => {
    const success = await saveResumeUrl(data.resume_url || '');
    if (success) {
      toast.success(`${mode === 'professional' ? 'Professional' : 'Creative'} resume URL updated successfully`);
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
      // One request: the backend deletes the previous R2 object (if it owns
      // one), uploads the new file, and sets site_settings.{mode}_resume_url
      // -- all server-side (MIGRATION_PLAN.md §7/§8), replacing the old
      // direct-to-Supabase-Storage upload + separate settings save.
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiClient.post<{ mode: string; url: string }>(
        `/resumes/${mode}`,
        formData
      );

      console.log('ResumeManager - File uploaded, saving URL:', result.url);

      form.reset({ resume_url: result.url });
      await queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      await queryClient.refetchQueries({ queryKey: ['site-settings'] });
      toast.success(`${mode === 'professional' ? 'Professional' : 'Creative'} resume uploaded successfully`);
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
    if (confirm(`Are you sure you want to remove the ${mode} resume?`)) {
      try {
        // One request: deletes the R2 object (if the backend owns it) and
        // clears site_settings.{mode}_resume_url together.
        await apiClient.delete(`/resumes/${mode}`);
        form.reset({ resume_url: '' });
        await queryClient.invalidateQueries({ queryKey: ['site-settings'] });
        await queryClient.refetchQueries({ queryKey: ['site-settings'] });
        toast.success('Resume removed successfully');
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

  const currentResumeUrl = getCurrentResumeUrl();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Resume Management
          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
            mode === 'professional' 
              ? 'bg-blue-500/20 text-blue-400' 
              : 'bg-orange-500/20 text-orange-400'
          }`}>
            {mode === 'professional' ? (
              <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> Professional</span>
            ) : (
              <span className="flex items-center gap-1"><Palette className="w-3 h-3" /> Creative</span>
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="ml-auto"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
        <CardDescription>
          Manage the resume for <strong>{mode}</strong> mode. Each mode can have a different resume.
        </CardDescription>
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
                        {uploading ? 'Uploading...' : `Upload ${mode === 'professional' ? 'Professional' : 'Creative'} Resume PDF`}
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
                      <FormLabel>{mode === 'professional' ? 'Professional' : 'Creative'} Resume URL</FormLabel>
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

        {currentResumeUrl && (
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => window.open(currentResumeUrl, '_blank')}
            >
              <Download className="w-4 h-4 mr-2" />
              Preview Resume
            </Button>
            
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  const settingsData: any = {
                    site_name: settings?.site_name || 'Portfolio',
                    logo_url: settings?.logo_url,
                  };

                  // Copy to the opposite mode
                  if (mode === 'professional') {
                    settingsData.creative_resume_url = currentResumeUrl;
                  } else {
                    settingsData.professional_resume_url = currentResumeUrl;
                  }
                  
                  await updateSettings.mutateAsync(settingsData);
                  await queryClient.invalidateQueries({ queryKey: ['site-settings'] });
                  toast.success(`Resume URL copied to ${mode === 'professional' ? 'Creative' : 'Professional'} mode`);
                } catch (error) {
                  toast.error('Failed to copy resume URL');
                  console.error('Error copying resume:', error);
                }
              }}
              disabled={updateSettings.isPending}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy to {mode === 'professional' ? 'Creative' : 'Professional'} Mode
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
