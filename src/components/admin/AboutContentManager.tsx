
import React, { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAboutContent, useCreateAboutContent, useUpdateAboutContent } from '@/hooks/useAboutContent';
import { toast } from 'sonner';
import { usePortfolio } from '@/contexts/PortfolioContext';

const AboutContentManager = () => {
  const { mode } = usePortfolio();
  const [formData, setFormData] = useState({
    content: '',
    section_title: 'About Me'
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: aboutContent = [], isLoading } = useAboutContent(mode);
  const createAboutContent = useCreateAboutContent();
  const updateAboutContent = useUpdateAboutContent();

  // Get the first (and only) about content for this mode
  const existingContent = aboutContent[0];

  // Load existing content when data loads or mode changes
  useEffect(() => {
    if (existingContent) {
      setFormData({
        content: existingContent.content || '',
        section_title: existingContent.section_title || 'About Me'
      });
      setHasChanges(false);
    } else {
      setFormData({
        content: '',
        section_title: 'About Me'
      });
      setHasChanges(false);
    }
  }, [existingContent, mode]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (existingContent) {
        await updateAboutContent.mutateAsync({
          id: existingContent.id,
          content: formData.content,
          section_title: formData.section_title,
        });
        toast.success('About content updated successfully');
      } else {
        await createAboutContent.mutateAsync({
          mode: mode,
          content: formData.content,
          section_title: formData.section_title,
          order_index: 0,
        });
        toast.success('About content created successfully');
      }
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save about content');
      console.error('Error saving about content:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">About Content Management</h3>
        <p className="text-sm text-muted-foreground">
          Editing <strong className="capitalize">{mode}</strong> mode content. Use mode toggle (bottom left) to switch.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About Section</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Section Title (Ribbon Text)</label>
              <Input
                value={formData.section_title}
                onChange={(e) => handleChange('section_title', e.target.value)}
                placeholder="About Me"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This text appears in the ribbon below the about content
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Content</label>
              <Textarea
                value={formData.content}
                onChange={(e) => handleChange('content', e.target.value)}
                placeholder="Enter your about content..."
                rows={6}
                required
              />
            </div>

            <Button 
              type="submit" 
              disabled={createAboutContent.isPending || updateAboutContent.isPending || !hasChanges}
            >
              {(createAboutContent.isPending || updateAboutContent.isPending) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AboutContentManager;
