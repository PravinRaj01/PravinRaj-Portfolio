
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContactContent, useUpdateContactContent } from '@/hooks/useContactContent';
import { toast } from 'sonner';
import { X, Plus, Mail, Phone, MapPin } from 'lucide-react';

const contactContentSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  phone: z.string().optional(),
  location: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().optional(),
});

type ContactContentFormData = z.infer<typeof contactContentSchema>;

const ContactContentManager = () => {
  const [activeMode, setActiveMode] = React.useState<'professional' | 'creative'>('professional');
  const { data: content, isLoading } = useContactContent(activeMode);
  const updateContent = useUpdateContactContent();
  const [services, setServices] = React.useState<string[]>([]);
  const [newService, setNewService] = React.useState('');

  const form = useForm<ContactContentFormData>({
    resolver: zodResolver(contactContentSchema),
    defaultValues: {
      email: content?.email || '',
      phone: content?.phone || '',
      location: content?.location || '',
      title: content?.title || '',
      subtitle: content?.subtitle || '',
    },
  });

  React.useEffect(() => {
    if (content) {
      form.reset({
        email: content.email,
        phone: content.phone || '',
        location: content.location || '',
        title: content.title,
        subtitle: content.subtitle || '',
      });
      setServices(content.services || []);
    }
  }, [content, form]);

  const onSubmit = async (data: ContactContentFormData) => {
    try {
      const contentData = {
        mode: activeMode,
        email: data.email,
        phone: data.phone || undefined,
        location: data.location || undefined,
        title: data.title,
        subtitle: data.subtitle || undefined,
        services: services,
      };
      await updateContent.mutateAsync(contentData);
      toast.success('Contact content updated successfully');
    } catch (error) {
      toast.error('Failed to update contact content');
      console.error('Error updating contact content:', error);
    }
  };

  const addService = () => {
    if (newService.trim() && !services.includes(newService.trim())) {
      setServices([...services, newService.trim()]);
      setNewService('');
    }
  };

  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Contact Page Content
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeMode} onValueChange={(value) => setActiveMode(value as 'professional' | 'creative')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="professional">Professional</TabsTrigger>
            <TabsTrigger value="creative">Creative</TabsTrigger>
          </TabsList>

          <TabsContent value={activeMode} className="space-y-6 mt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Page Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Get In Touch" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="hello@portfolio.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 123-4567" {...field} />
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
                        <FormLabel>Location (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="San Francisco, CA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="subtitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtitle</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Let's discuss your next project..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <FormLabel>Services Offered</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a service..."
                      value={newService}
                      onChange={(e) => setNewService(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
                    />
                    <Button type="button" onClick={addService} size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {services.map((service, index) => (
                      <Badge key={index} variant="secondary" className="text-sm">
                        {service}
                        <button
                          type="button"
                          onClick={() => removeService(index)}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button type="submit" disabled={updateContent.isPending}>
                  {updateContent.isPending ? 'Updating...' : 'Update Contact Content'}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ContactContentManager;
