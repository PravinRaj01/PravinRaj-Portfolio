import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Plus, Trash2, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useMagazineAdmin } from '@/hooks/useMagazine';
import { useProjects } from '@/hooks/useProjects';
import { supabase } from '@/utils/supabase';

const MagazineManager = () => {
  const { issues, loading, publishIssue, unpublishIssue, deleteIssue, saveIssue } = useMagazineAdmin();
  const { projects } = useProjects('creative');
  const [generating, setGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [themeHint, setThemeHint] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const featuredProjects = projects.filter(p => p.featured);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    projects.forEach(p => {
      if (p.category) cats.add(p.category);
      if (p.categories) (p.categories as string[]).forEach(c => cats.add(c));
    });
    return Array.from(cats).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (categoryFilter === 'all') return projects;
    return projects.filter(p =>
      p.category === categoryFilter || (p.categories as string[] | null)?.includes(categoryFilter)
    );
  }, [projects, categoryFilter]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-magazine', {
        body: {
          project_ids: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
          theme_hint: themeHint || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPreviewContent(data);
      toast({ title: 'Magazine generated!', description: 'Review the content below and save when ready.' });
    } catch (err) {
      toast({ title: 'Generation failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!previewContent) return;
    try {
      await saveIssue({
        title: previewContent.title,
        is_published: false,
        mode: 'creative',
        cover_headline: previewContent.cover_headline,
        cover_subhead: previewContent.cover_subhead,
        content: previewContent.content,
        project_ids: previewContent.project_ids,
      });
      setPreviewContent(null);
      setDialogOpen(false);
      setThemeHint('');
      setSelectedProjectIds([]);
      toast({ title: 'Issue saved!', description: 'You can now publish it.' });
    } catch (err) {
      toast({ title: 'Save failed', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const toggleProject = (id: string) => {
    setSelectedProjectIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Magazine Issues
          </h3>
          <p className="text-sm text-muted-foreground">AI-generated magazine from your creative projects</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setPreviewContent(null); setThemeHint(''); setSelectedProjectIds([]); }}>
              <Plus className="w-4 h-4 mr-2" /> Draft New Issue
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Generate Magazine Issue</DialogTitle>
              <DialogDescription>The AI will transform your projects into a high-end magazine feature.</DialogDescription>
            </DialogHeader>

            {!previewContent ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Theme / Tone Hint (optional)</label>
                  <Textarea
                    placeholder="e.g. 'Focus on AI projects', 'Futuristic and bold', 'Highlight recent work'"
                    value={themeHint}
                    onChange={e => setThemeHint(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Projects to include</label>
                  <p className="text-xs text-muted-foreground mb-2">Leave empty to use featured projects ({featuredProjects.length} found)</p>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="mb-2">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {allCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {filteredProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => toggleProject(p.id)}
                        className={`text-left p-2 rounded-md border text-sm transition-colors ${
                          selectedProjectIds.includes(p.id)
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <span className="font-medium">{p.title}</span>
                        {p.featured && <Badge variant="secondary" className="ml-1 text-[10px]">Featured</Badge>}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleGenerate} disabled={generating} className="w-full">
                  {generating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating (may take 15-30s)...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Generate Magazine</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted">
                  <h4 className="font-bold text-lg">{previewContent.content.cover.headline}</h4>
                  <p className="text-muted-foreground">{previewContent.content.cover.subhead}</p>
                </div>

                <div className="p-3 rounded-lg border">
                  <h5 className="font-semibold text-sm">{previewContent.content.editors_note.title}</h5>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{previewContent.content.editors_note.body}</p>
                </div>

                <div className="space-y-2">
                  <h5 className="font-semibold text-sm">Articles ({previewContent.content.articles.length})</h5>
                  {previewContent.content.articles.map((a: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg border">
                      <p className="font-medium text-sm">{a.headline}</p>
                      <p className="text-xs text-muted-foreground italic">"{a.pull_quote}"</p>
                      <Badge variant="outline" className="text-[10px] mt-1">{a.layout}</Badge>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-lg border">
                  <h5 className="font-semibold text-sm">{previewContent.content.closing.title}</h5>
                  <p className="text-xs text-muted-foreground mt-1">{previewContent.content.closing.body}</p>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setPreviewContent(null)}>Re-generate</Button>
                  <Button onClick={handleSave}><BookOpen className="w-4 h-4 mr-2" /> Save Issue</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {issues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No magazine issues yet. Click "Draft New Issue" to generate your first one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {issues.map(issue => (
            <motion.div key={issue.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{issue.title}</h4>
                      {issue.is_published && <Badge variant="secondary" className="text-primary">Published</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {issue.content.articles?.length || 0} articles · Created {new Date(issue.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {issue.is_published ? (
                      <Button variant="outline" size="sm" onClick={() => unpublishIssue(issue.id)}>
                        <EyeOff className="w-4 h-4 mr-1" /> Unpublish
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => publishIssue(issue.id)}>
                        <Eye className="w-4 h-4 mr-1" /> Publish
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this issue?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteIssue(issue.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MagazineManager;
