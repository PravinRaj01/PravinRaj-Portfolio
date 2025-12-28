import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useSiteSettings, useUpdateSiteSettings } from '@/hooks/useSiteSettings';
import { toast } from 'sonner';
import { Briefcase, Palette, AlertCircle, Layout, Eye } from 'lucide-react';

const AVAILABLE_PAGES = [
  { id: 'home', label: 'Home', description: 'Main landing page' },
  { id: 'projects', label: 'Projects', description: 'Projects showcase page' },
  { id: 'experience', label: 'Experience', description: 'Work experience page' },
  { id: 'academic', label: 'Academic', description: 'Education, certifications & achievements' },
  { id: 'contact', label: 'Contact', description: 'Contact form page' },
  { id: 'podcast', label: 'Podcast', description: 'Podcast/media page' },
];

const modeSettingsSchema = z.object({
  professional_mode_enabled: z.boolean(),
  creative_mode_enabled: z.boolean(),
  default_mode: z.enum(['professional', 'creative']),
  mode_toggle_pages: z.array(z.string()),
  professional_visible_pages: z.array(z.string()),
  creative_visible_pages: z.array(z.string()),
}).refine((data) => data.professional_mode_enabled || data.creative_mode_enabled, {
  message: "At least one mode must be enabled",
  path: ['professional_mode_enabled'],
});

type ModeSettingsFormData = z.infer<typeof modeSettingsSchema>;

const ModeSettingsManager = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();

  const form = useForm<ModeSettingsFormData>({
    resolver: zodResolver(modeSettingsSchema),
    defaultValues: {
      professional_mode_enabled: settings?.professional_mode_enabled ?? true,
      creative_mode_enabled: settings?.creative_mode_enabled ?? true,
      default_mode: settings?.default_mode ?? 'professional',
      mode_toggle_pages: settings?.mode_toggle_pages ?? AVAILABLE_PAGES.map(p => p.id),
      professional_visible_pages: settings?.professional_visible_pages ?? AVAILABLE_PAGES.map(p => p.id),
      creative_visible_pages: settings?.creative_visible_pages ?? AVAILABLE_PAGES.map(p => p.id),
    },
  });

  const professionalEnabled = form.watch('professional_mode_enabled');
  const creativeEnabled = form.watch('creative_mode_enabled');

  React.useEffect(() => {
    if (settings) {
      form.reset({
        professional_mode_enabled: settings.professional_mode_enabled ?? true,
        creative_mode_enabled: settings.creative_mode_enabled ?? true,
        default_mode: settings.default_mode ?? 'professional',
        mode_toggle_pages: settings.mode_toggle_pages ?? AVAILABLE_PAGES.map(p => p.id),
        professional_visible_pages: settings.professional_visible_pages ?? AVAILABLE_PAGES.map(p => p.id),
        creative_visible_pages: settings.creative_visible_pages ?? AVAILABLE_PAGES.map(p => p.id),
      });
    }
  }, [settings, form]);

  // Auto-adjust default mode when a mode is disabled
  React.useEffect(() => {
    const currentDefault = form.getValues('default_mode');
    if (currentDefault === 'professional' && !professionalEnabled && creativeEnabled) {
      form.setValue('default_mode', 'creative');
    } else if (currentDefault === 'creative' && !creativeEnabled && professionalEnabled) {
      form.setValue('default_mode', 'professional');
    }
  }, [professionalEnabled, creativeEnabled, form]);

  const onSubmit = async (data: ModeSettingsFormData) => {
    try {
      const settingsData = {
        site_name: settings?.site_name || 'Portfolio',
        logo_url: settings?.logo_url,
        resume_url: settings?.resume_url,
        professional_mode_enabled: data.professional_mode_enabled,
        creative_mode_enabled: data.creative_mode_enabled,
        default_mode: data.default_mode,
        mode_toggle_pages: data.mode_toggle_pages,
        professional_visible_pages: data.professional_visible_pages,
        creative_visible_pages: data.creative_visible_pages,
      };
      await updateSettings.mutateAsync(settingsData);
      toast.success('Mode settings updated successfully');
    } catch (error) {
      toast.error('Failed to update mode settings');
      console.error('Error updating mode settings:', error);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Mode Settings
        </CardTitle>
        <CardDescription>
          Control which portfolio modes are available to visitors and set the default mode
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Mode Toggles */}
            <div className="space-y-6">
              <h4 className="text-sm font-medium">Enable/Disable Modes</h4>
              
              <FormField
                control={form.control}
                name="professional_mode_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <FormLabel className="text-base">Professional Mode</FormLabel>
                      </div>
                      <FormDescription>
                        Show your professional portfolio with work experience, technical skills, and projects
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!creativeEnabled && field.value}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="creative_mode_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-accent" />
                        <FormLabel className="text-base">Creative Mode</FormLabel>
                      </div>
                      <FormDescription>
                        Show your creative portfolio with design work, multimedia projects, and artistic content
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!professionalEnabled && field.value}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!professionalEnabled && !creativeEnabled && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  At least one mode must be enabled
                </div>
              )}
            </div>

            {/* Default Mode Selection */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Default Mode</h4>
              <FormField
                control={form.control}
                name="default_mode"
                render={({ field }) => (
                  <FormItem>
                    <FormDescription className="mb-4">
                      Choose which mode visitors see when they first visit your portfolio
                    </FormDescription>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid grid-cols-2 gap-4"
                      >
                        <FormItem>
                          <FormControl>
                            <div className="relative">
                              <RadioGroupItem
                                value="professional"
                                id="professional"
                                className="peer sr-only"
                                disabled={!professionalEnabled}
                              />
                              <label
                                htmlFor="professional"
                                className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer transition-all
                                  ${!professionalEnabled ? 'opacity-50 cursor-not-allowed' : ''}
                                  ${field.value === 'professional' 
                                    ? 'border-primary bg-primary/10' 
                                    : 'border-muted hover:border-primary/50'
                                  }`}
                              >
                                <Briefcase className={`mb-3 h-8 w-8 ${field.value === 'professional' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className="font-medium">Professional</span>
                                <span className="text-xs text-muted-foreground text-center mt-1">
                                  Technical & career focused
                                </span>
                              </label>
                            </div>
                          </FormControl>
                        </FormItem>
                        <FormItem>
                          <FormControl>
                            <div className="relative">
                              <RadioGroupItem
                                value="creative"
                                id="creative"
                                className="peer sr-only"
                                disabled={!creativeEnabled}
                              />
                              <label
                                htmlFor="creative"
                                className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer transition-all
                                  ${!creativeEnabled ? 'opacity-50 cursor-not-allowed' : ''}
                                  ${field.value === 'creative' 
                                    ? 'border-accent bg-accent/10' 
                                    : 'border-muted hover:border-accent/50'
                                  }`}
                              >
                                <Palette className={`mb-3 h-8 w-8 ${field.value === 'creative' ? 'text-accent' : 'text-muted-foreground'}`} />
                                <span className="font-medium">Creative</span>
                                <span className="text-xs text-muted-foreground text-center mt-1">
                                  Design & artistic focus
                                </span>
                              </label>
                            </div>
                          </FormControl>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Page-Level Mode Toggle */}
            {professionalEnabled && creativeEnabled && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  <h4 className="text-sm font-medium">Mode Toggle Visibility</h4>
                </div>
                <FormDescription>
                  Select which pages should display the Pro/Creative mode toggle button
                </FormDescription>
                
                <FormField
                  control={form.control}
                  name="mode_toggle_pages"
                  render={({ field }) => (
                    <FormItem>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {AVAILABLE_PAGES.map((page) => (
                          <FormItem
                            key={page.id}
                            className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(page.id)}
                                onCheckedChange={(checked) => {
                                  const currentPages = field.value || [];
                                  if (checked) {
                                    field.onChange([...currentPages, page.id]);
                                  } else {
                                    field.onChange(currentPages.filter((p) => p !== page.id));
                                  }
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm font-medium">
                                {page.label}
                              </FormLabel>
                              <FormDescription className="text-xs">
                                {page.description}
                              </FormDescription>
                            </div>
                          </FormItem>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Page Visibility Per Mode */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <h4 className="text-sm font-medium">Page Visibility</h4>
              </div>
              <FormDescription>
                Control which pages are visible to public visitors for each mode
              </FormDescription>
              
              {/* Professional Mode Pages */}
              {professionalEnabled && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Professional Mode Pages</span>
                  </div>
                  <FormField
                    control={form.control}
                    name="professional_visible_pages"
                    render={({ field }) => (
                      <FormItem>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {AVAILABLE_PAGES.map((page) => (
                            <FormItem
                              key={page.id}
                              className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-primary/20 p-3"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(page.id)}
                                  onCheckedChange={(checked) => {
                                    const currentPages = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentPages, page.id]);
                                    } else {
                                      field.onChange(currentPages.filter((p) => p !== page.id));
                                    }
                                  }}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-medium">
                                  {page.label}
                                </FormLabel>
                              </div>
                            </FormItem>
                          ))}
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Creative Mode Pages */}
              {creativeEnabled && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium">Creative Mode Pages</span>
                  </div>
                  <FormField
                    control={form.control}
                    name="creative_visible_pages"
                    render={({ field }) => (
                      <FormItem>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {AVAILABLE_PAGES.map((page) => (
                            <FormItem
                              key={page.id}
                              className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-accent/20 p-3"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(page.id)}
                                  onCheckedChange={(checked) => {
                                    const currentPages = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentPages, page.id]);
                                    } else {
                                      field.onChange(currentPages.filter((p) => p !== page.id));
                                    }
                                  }}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-medium">
                                  {page.label}
                                </FormLabel>
                              </div>
                            </FormItem>
                          ))}
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? 'Saving...' : 'Save Mode Settings'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ModeSettingsManager;
