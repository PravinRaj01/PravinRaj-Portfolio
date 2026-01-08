import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Github, Linkedin, Twitter, Globe, Instagram, Youtube, Facebook, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useSocials, useCreateSocial, useUpdateSocial, useDeleteSocial, Social } from '@/hooks/useSocials';

const SocialManager = () => {
  const { data: socials = [], isLoading } = useSocials();
  const createSocial = useCreateSocial();
  const updateSocial = useUpdateSocial();
  const deleteSocial = useDeleteSocial();
  
  const [pendingChanges, setPendingChanges] = useState<{ [key: string]: Partial<Social> }>({});
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSocial, setEditingSocial] = useState<Social | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: 'github',
    url: '',
    enabled: true,
    order_index: 0,
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingSocial) {
        await updateSocial.mutateAsync({ id: editingSocial.id, ...formData });
        toast.success('Social link updated successfully');
      } else {
        await createSocial.mutateAsync({
          ...formData,
          order_index: socials.length,
        });
        toast.success('Social link added successfully');
      }
      
      setShowForm(false);
      setEditingSocial(null);
      setFormData({
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

  const handleEdit = (social: Social) => {
    setEditingSocial(social);
    setFormData({
      name: social.name,
      icon: social.icon,
      url: social.url,
      enabled: social.enabled,
      order_index: social.order_index,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
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

  if (isLoading) {
    return <div className="text-center py-8">Loading social links...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Social Media Links</h2>
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
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Social Link
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingSocial ? 'Edit' : 'Add'} Social Link</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., GitHub"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <Select
                    value={formData.icon}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}
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
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://github.com/username"
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(enabled) => setFormData(prev => ({ ...prev, enabled }))}
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
                    setShowForm(false);
                    setEditingSocial(null);
                    setFormData({
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
                        <p className="text-sm text-muted-foreground">{social.url}</p>
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
                      <Button size="sm" variant="outline" onClick={() => handleEdit(social)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(social.id)}
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
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Social Link
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SocialManager;
