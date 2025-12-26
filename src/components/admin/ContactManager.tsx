import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit, Trash2, Github, Linkedin, Twitter, Globe, Instagram, Youtube, Facebook, Save, Mail, Phone, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useSocials, useCreateSocial, useUpdateSocial, useDeleteSocial, Social } from '@/hooks/useSocials';
import { useContactContent, useUpdateContactContent } from '@/hooks/useContactContent';
import { X } from 'lucide-react';

const contactContentSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  phone: z.string().optional(),
  location: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().optional(),
});

type ContactContentFormData = z.infer<typeof contactContentSchema>;

const ContactManager = () => {
  const [activeSection, setActiveSection] = useState<'contact' | 'socials'>('contact');
  
  // Contact content hooks - use 'professional' as the shared mode
  const { data: contactContent, isLoading: contactLoading } = useContactContent('professional');
  const updateContactContent = useUpdateContactContent();
  const [services, setServices] = useState<string[]>([]);
  const [newService, setNewService] = useState('');

  // Social hooks
  const { data: socials = [], isLoading: socialsLoading } = useSocials();
  const createSocial = useCreateSocial();
  const updateSocial = useUpdateSocial();
  const deleteSocial = useDeleteSocial();
  
  const [pendingChanges, setPendingChanges] = useState<{ [key: string]: Partial<Social> }>({});
  const [saving, setSaving] = useState(false);
  const [showSocialForm, setShowSocialForm] = useState(false);
  const [editingSocial, setEditingSocial] = useState<Social | null>(null);
  const [socialFormData, setSocialFormData] = useState({
    name: '',
    icon: 'github',
    url: '',
    enabled: true,
    order_index: 0,
  });

  const form = useForm<ContactContentFormData>({
    resolver: zodResolver(contactContentSchema),
    defaultValues: {
      email: '',
      phone: '',
      location: '',
      title: '',
      subtitle: '',
    },
  });

  useEffect(() => {
    if (contactContent) {
      form.reset({
        email: contactContent.email,
        phone: contactContent.phone || '',
        location: contactContent.location || '',
        title: contactContent.title,
        subtitle: contactContent.subtitle || '',
      });
      setServices(contactContent.services || []);
    }
  }, [contactContent, form]);

  const iconOptions = [
    { value: 'github', label: 'GitHub', icon: Github },
    { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
    { value: 'twitter', label: 'Twitter', icon: Twitter },
    { value: 'instagram', label: 'Instagram', icon: Instagram },
    { value: 'youtube', label: 'YouTube', icon: Youtube },
    { value: 'facebook', label: 'Facebook', icon: Facebook },
    { value: 'globe', label: 'Website', icon: Globe },
  ];

  const getIconComponent = (iconName: string) => {
    const option = iconOptions.find(opt => opt.value === iconName);
    return option ? option.icon : Globe;
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  // Contact form handlers
  const onContactSubmit = async (data: ContactContentFormData) => {
    try {
      const contentData = {
        mode: 'professional' as const, // Use professional as shared mode
        email: data.email,
        phone: data.phone || undefined,
        location: data.location || undefined,
        title: data.title,
        subtitle: data.subtitle || undefined,
        services: services,
      };
      await updateContactContent.mutateAsync(contentData);
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

  // Social handlers
  const handleSocialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingSocial) {
        await updateSocial.mutateAsync({ id: editingSocial.id, ...socialFormData });
        toast.success('Social link updated successfully');
      } else {
        await createSocial.mutateAsync({
          ...socialFormData,
          order_index: socials.length,
        });
        toast.success('Social link added successfully');
      }
      
      setShowSocialForm(false);
      setEditingSocial(null);
      setSocialFormData({
        name: '',
        icon: 'github',
        url: '',
        enabled: true,
        order_index: 0,
      });
    } catch (error) {
      console.error('Failed to save social:', error);
      toast.error('Failed to save social link');
    }
  };

  const handleEditSocial = (social: Social) => {
    setEditingSocial(social);
    setSocialFormData({
      name: social.name,
      icon: social.icon,
      url: social.url,
      enabled: social.enabled,
      order_index: social.order_index,
    });
    setShowSocialForm(true);
  };

  const handleDeleteSocial = async (id: string) => {
    if (confirm('Are you sure you want to delete this social link?')) {
      try {
        await deleteSocial.mutateAsync(id);
        toast.success('Social link deleted successfully');
      } catch (error) {
        console.error('Failed to delete social:', error);
        toast.error('Failed to delete social link');
      }
    }
  };

  const handleToggleChange = (id: string, enabled: boolean) => {
    setPendingChanges(prev => ({
      ...prev,
      [id]: { ...prev[id], enabled }
    }));
  };

  const savePendingChanges = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(pendingChanges).map(([id, changes]) => 
        updateSocial.mutateAsync({ id, ...changes })
      );

      await Promise.all(updates);
      setPendingChanges({});
      toast.success('Changes saved successfully');
    } catch (error) {
      console.error('Failed to save changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setPendingChanges({});
    toast.info('Changes discarded');
  };

  if (contactLoading || socialsLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as 'contact' | 'socials')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="contact" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Contact Info
          </TabsTrigger>
          <TabsTrigger value="socials" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Social Links
          </TabsTrigger>
        </TabsList>

        {/* Contact Info Section */}
        <TabsContent value="contact" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Contact Page Content
              </CardTitle>
              <CardDescription>
                Manage your contact information displayed on the Contact page and Share button (applies to both modes)
              </CardDescription>
            </CardHeader>
            <CardContent>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onContactSubmit)} className="space-y-6">
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
                            placeholder="Open to new opportunities, collaborations, and exciting projects..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <FormLabel>Services / Available For</FormLabel>
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

                  <Button type="submit" disabled={updateContactContent.isPending}>
                    {updateContactContent.isPending ? 'Updating...' : 'Update Contact Content'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Links Section */}
        <TabsContent value="socials" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Social Media Links</h2>
              <p className="text-muted-foreground">These appear on the Contact page and Share button</p>
            </div>
            <div className="flex gap-2">
              {hasPendingChanges && (
                <>
                  <Button variant="outline" onClick={discardChanges} disabled={saving}>
                    Discard Changes
                  </Button>
                  <Button onClick={savePendingChanges} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              )}
              <Button onClick={() => setShowSocialForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Social Link
              </Button>
            </div>
          </div>

          {showSocialForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingSocial ? 'Edit' : 'Add'} Social Link</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSocialSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={socialFormData.name}
                        onChange={(e) => setSocialFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., GitHub"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="icon">Icon</Label>
                      <Select
                        value={socialFormData.icon}
                        onValueChange={(value) => setSocialFormData(prev => ({ ...prev, icon: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {iconOptions.map((option) => {
                            const IconComponent = option.icon;
                            return (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center">
                                  <IconComponent className="w-4 h-4 mr-2" />
                                  {option.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      type="url"
                      value={socialFormData.url}
                      onChange={(e) => setSocialFormData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://github.com/username"
                      required
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enabled"
                      checked={socialFormData.enabled}
                      onCheckedChange={(enabled) => setSocialFormData(prev => ({ ...prev, enabled }))}
                    />
                    <Label htmlFor="enabled">Enabled</Label>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button type="submit" disabled={createSocial.isPending || updateSocial.isPending}>
                      {editingSocial ? 'Update' : 'Add'} Social Link
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowSocialForm(false);
                        setEditingSocial(null);
                        setSocialFormData({
                          name: '',
                          icon: 'github',
                          url: '',
                          enabled: true,
                          order_index: 0,
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {socials.map((social) => {
              const IconComponent = getIconComponent(social.icon);
              const pendingEnabled = pendingChanges[social.id]?.enabled;
              const currentEnabled = pendingEnabled !== undefined ? pendingEnabled : social.enabled;
              const hasChange = pendingEnabled !== undefined;
              
              return (
                <motion.div
                  key={social.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group"
                >
                  <Card className={`hover:shadow-lg transition-shadow ${hasChange ? 'ring-2 ring-primary/50' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-lg ${currentEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
                            <IconComponent className={`w-5 h-5 ${currentEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <h3 className="font-medium">{social.name}</h3>
                            <p className="text-sm text-muted-foreground truncate max-w-xs">{social.url}</p>
                          </div>
                          {!currentEnabled && (
                            <span className="text-xs bg-muted px-2 py-1 rounded">Disabled</span>
                          )}
                          {hasChange && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              Pending
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Switch
                            checked={currentEnabled}
                            onCheckedChange={(enabled) => handleToggleChange(social.id, enabled)}
                          />
                          <Button size="sm" variant="outline" onClick={() => handleEditSocial(social)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteSocial(social.id)}
                            disabled={deleteSocial.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {socials.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-muted-foreground mb-4">No social media links configured</p>
                <Button onClick={() => setShowSocialForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Social Link
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContactManager;
