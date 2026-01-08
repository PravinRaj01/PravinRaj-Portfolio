import React, { useState, useEffect } from 'react';
import { Save, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGithubTicker, useUpdateGithubTicker } from '@/hooks/useGithubTicker';
import { toast } from 'sonner';

const GithubTickerManager = () => {
  const { data: tickerData, isLoading } = useGithubTicker();
  const updateTicker = useUpdateGithubTicker();
  
  const [formData, setFormData] = useState({
    text: '',
    url: ''
  });

  useEffect(() => {
    if (tickerData) {
      setFormData({
        text: tickerData.text,
        url: tickerData.url
      });
    }
  }, [tickerData]);

  const handleSave = async () => {
    if (!tickerData) return;
    
    try {
      await updateTicker.mutateAsync({
        id: tickerData.id,
        text: formData.text,
        url: formData.url
      });
      toast.success('GitHub ticker updated successfully');
    } catch (error) {
      toast.error('Failed to update GitHub ticker');
      console.error('Error updating ticker:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading ticker settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">GitHub Ticker Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure the scrolling ticker text and link that appears on the homepage
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ticker Content</CardTitle>
          <CardDescription>
            This text scrolls across the page between sections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ticker-text">Ticker Text</Label>
            <Input
              id="ticker-text"
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              placeholder="More Projects on Github"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticker-url">Link URL</Label>
            <div className="flex gap-2">
              <Input
                id="ticker-url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://github.com/username"
              />
              {formData.url && (
                <Button variant="outline" size="icon" asChild>
                  <a href={formData.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          <Button 
            onClick={handleSave} 
            disabled={updateTicker.isPending}
            className="w-full sm:w-auto"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateTicker.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default GithubTickerManager;
