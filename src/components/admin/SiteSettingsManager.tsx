import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { useSiteSettings, useUpdateSiteSettings } from '@/hooks/useSiteSettings';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { toast } from 'sonner';
import { Bot } from 'lucide-react';

const siteSettingsSchema = z.object({
  site_name: z.string().min(1, 'Site name is required'),
  logo_url: z.string().optional(),
  chatbot_enabled: z.boolean().default(true),
});

type SiteSettingsFormData = z.infer<typeof siteSettingsSchema>;

const SiteSettingsManager = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const { mode } = usePortfolio();

  const isProfessional = mode === 'professional';

  // Get the current mode's values
  const currentSiteName = isProfessional 
    ? (settings?.professional_site_name || settings?.site_name || 'Portfolio')
    : (settings?.creative_site_name || settings?.site_name || 'Portfolio');
  
  const currentLogoUrl = isProfessional
    ? (settings?.professional_logo_url || settings?.logo_url || '')
    : (settings?.creative_logo_url || settings?.logo_url || '');

  const form = useForm<SiteSettingsFormData>({
    resolver: zodResolver(siteSettingsSchema),
    defaultValues: {
      site_name: currentSiteName,
      logo_url: currentLogoUrl,
      chatbot_enabled: settings?.chatbot_enabled !== false,
    },
  });

  React.useEffect(() => {
    if (settings) {
      const siteName = isProfessional 
        ? (settings.professional_site_name || settings.site_name)
        : (settings.creative_site_name || settings.site_name);
      
      const logoUrl = isProfessional
        ? (settings.professional_logo_url || settings.logo_url || '')
        : (settings.creative_logo_url || settings.logo_url || '');

      form.reset({
        site_name: siteName,
        logo_url: logoUrl,
        chatbot_enabled: settings.chatbot_enabled !== false,
      });
    }
  }, [settings, form, isProfessional]);

  const onSubmit = async (data: SiteSettingsFormData) => {
    try {
      const settingsData = {
        site_name: settings?.site_name || data.site_name,
        logo_url: settings?.logo_url || data.logo_url || undefined,
        chatbot_enabled: data.chatbot_enabled,
        resume_url: settings?.resume_url || undefined,
        professional_site_name: isProfessional ? data.site_name : (settings?.professional_site_name || undefined),
        professional_logo_url: isProfessional ? (data.logo_url || undefined) : (settings?.professional_logo_url || undefined),
        creative_site_name: !isProfessional ? data.site_name : (settings?.creative_site_name || undefined),
        creative_logo_url: !isProfessional ? (data.logo_url || undefined) : (settings?.creative_logo_url || undefined),
      };

      await updateSettings.mutateAsync(settingsData);
      toast.success(`${isProfessional ? 'Professional' : 'Creative'} mode settings updated`);
    } catch (error) {
      toast.error('Failed to update site settings');
      console.error('Error updating site settings:', error);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Settings</CardTitle>
        <CardDescription>
          Configure site name and logo for {isProfessional ? 'Professional' : 'Creative'} mode
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="site_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Portfolio" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/logo.png" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="chatbot_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      AI Portfolio Assistant
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? 'Updating...' : 'Update Settings'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default SiteSettingsManager;
