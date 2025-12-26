
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAboutContent, useCreateAboutContent, useUpdateAboutContent, useDeleteAboutContent } from '@/hooks/useAboutContent';
import { toast } from 'sonner';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { AboutContent } from '@/types/content';

const AboutContentManager = () => {
  const { mode } = usePortfolio();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    content: '',
    order_index: 0
  });

  const { data: aboutContent = [] } = useAboutContent(mode);
  const createAboutContent = useCreateAboutContent();
  const updateAboutContent = useUpdateAboutContent();
  const deleteAboutContent = useDeleteAboutContent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        await updateAboutContent.mutateAsync({
          id: editingId,
          ...formData,
        });
        toast.success('About content updated successfully');
        setEditingId(null);
      } else {
        await createAboutContent.mutateAsync({
          mode: mode,
          ...formData,
        });
        toast.success('About content created successfully');
        setIsAdding(false);
      }
      
      setFormData({ content: '', order_index: 0 });
    } catch (error) {
      toast.error('Failed to save about content');
      console.error('Error saving about content:', error);
    }
  };

  const handleEdit = (content: AboutContent) => {
    setFormData({
      content: content.content,
      order_index: content.order_index,
    });
    setEditingId(content.id);
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAboutContent.mutateAsync(id);
      toast.success('About content deleted successfully');
    } catch (error) {
      toast.error('Failed to delete about content');
      console.error('Error deleting about content:', error);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ content: '', order_index: 0 });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">About Content Management</h3>
          <p className="text-sm text-muted-foreground">
            Editing <strong className="capitalize">{mode}</strong> mode content. Use mode toggle (bottom left) to switch.
          </p>
        </div>
        <Button onClick={() => setIsAdding(true)} disabled={isAdding || editingId !== null}>
          <Plus className="w-4 h-4 mr-2" />
          Add Content
        </Button>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit About Content' : 'Add About Content'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Content</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter about content..."
                  rows={6}
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Order Index</label>
                <Input
                  type="number"
                  value={formData.order_index}
                  onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createAboutContent.isPending || updateAboutContent.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingId ? 'Update' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Content List */}
      <div className="space-y-4">
        {aboutContent.map((content, index) => (
          <motion.div
            key={content.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">About Content #{content.order_index}</CardTitle>
                    <Badge variant="secondary">{content.mode}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(content)}
                      disabled={isAdding || (editingId && editingId !== content.id)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(content.id)}
                      disabled={isAdding || editingId !== null}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {content.content}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {aboutContent.length === 0 && !isAdding && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No about content found for {mode} mode.</p>
            <Button onClick={() => setIsAdding(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Add First Content
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AboutContentManager;
