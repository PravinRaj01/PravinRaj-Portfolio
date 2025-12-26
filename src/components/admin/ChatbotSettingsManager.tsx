import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSiteSettings, useUpdateSiteSettings } from '@/hooks/useSiteSettings';
import { toast } from 'sonner';
import { Bot, MessageCircle, Maximize2, PanelRight } from 'lucide-react';

const chatbotSettingsSchema = z.object({
  chatbot_enabled: z.boolean().default(true),
  chatbot_name: z.string().min(1, 'Name is required').default('Portfolio Assistant'),
  chatbot_welcome_message: z.string().min(1, 'Welcome message is required').default('Hi there! 👋 I can help you learn about my skills, projects, and experience.'),
  chatbot_default_state: z.enum(['mini', 'sidebar', 'full']).default('mini'),
});

type ChatbotSettingsFormData = z.infer<typeof chatbotSettingsSchema>;

const ChatbotSettingsManager = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();

  const form = useForm<ChatbotSettingsFormData>({
    resolver: zodResolver(chatbotSettingsSchema),
    defaultValues: {
      chatbot_enabled: settings?.chatbot_enabled !== false,
      chatbot_name: settings?.chatbot_name || 'Portfolio Assistant',
      chatbot_welcome_message: settings?.chatbot_welcome_message || 'Hi there! 👋 I can help you learn about my skills, projects, and experience.',
      chatbot_default_state: settings?.chatbot_default_state || 'mini',
    },
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        chatbot_enabled: settings.chatbot_enabled !== false,
        chatbot_name: settings.chatbot_name || 'Portfolio Assistant',
        chatbot_welcome_message: settings.chatbot_welcome_message || 'Hi there! 👋 I can help you learn about my skills, projects, and experience.',
        chatbot_default_state: settings.chatbot_default_state || 'mini',
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: ChatbotSettingsFormData) => {
    try {
      const settingsData = {
        site_name: settings?.site_name || 'Portfolio',
        chatbot_enabled: data.chatbot_enabled,
        chatbot_name: data.chatbot_name,
        chatbot_welcome_message: data.chatbot_welcome_message,
        chatbot_default_state: data.chatbot_default_state,
      };
      await updateSettings.mutateAsync(settingsData);
      toast.success('Chatbot settings updated successfully');
    } catch (error) {
      toast.error('Failed to update chatbot settings');
      console.error('Error updating chatbot settings:', error);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Chatbot Settings
        </CardTitle>
        <CardDescription>Configure the AI portfolio assistant that helps visitors learn about your work</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="chatbot_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Enable Chatbot
                    </FormLabel>
                    <FormDescription>
                      Show the AI chatbot button on your portfolio
                    </FormDescription>
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

            <FormField
              control={form.control}
              name="chatbot_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chatbot Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Portfolio Assistant" {...field} />
                  </FormControl>
                  <FormDescription>
                    The name displayed in the chatbot header
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="chatbot_welcome_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Welcome Message</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Hi there! 👋 I can help you learn about my skills, projects, and experience."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    The greeting message shown when visitors start a new conversation
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="chatbot_default_state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Size</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select default size" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mini">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          Mini - Compact popup
                        </div>
                      </SelectItem>
                      <SelectItem value="sidebar">
                        <div className="flex items-center gap-2">
                          <PanelRight className="h-4 w-4" />
                          Sidebar - Side panel
                        </div>
                      </SelectItem>
                      <SelectItem value="full">
                        <div className="flex items-center gap-2">
                          <Maximize2 className="h-4 w-4" />
                          Full - Full screen
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How the chatbot opens by default when clicked
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? 'Updating...' : 'Save Chatbot Settings'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ChatbotSettingsManager;
