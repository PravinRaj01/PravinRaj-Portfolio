import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import ReactMarkdown from 'react-markdown';

export interface GeneratorData {
  title?: string;
  category?: string;
  categories?: string[];
  tags?: string[];
  positions?: string[];
  date?: string;
  period?: string;
  company?: string;
  location?: string;
  role?: string;
  images?: string[];
  achievements?: string[];
}

interface DescriptionGeneratorProps {
  entityType: 'project' | 'experience';
  mode: 'professional' | 'creative';
  data: GeneratorData;
  onGenerated: (description: string) => void;
  disabled?: boolean;
}

type GeneratorStep = 'idle' | 'context' | 'generating' | 'preview';

const DescriptionGenerator = ({
  entityType,
  mode,
  data,
  onGenerated,
  disabled = false,
}: DescriptionGeneratorProps) => {
  const [step, setStep] = useState<GeneratorStep>('idle');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const hasMinimumData = Boolean(data.title?.trim());

  const getDataSummary = () => {
    const items: { label: string; value: string }[] = [];
    
    if (data.title) items.push({ label: 'Title', value: data.title });
    if (data.categories?.length) items.push({ label: 'Categories', value: data.categories.join(', ') });
    else if (data.category) items.push({ label: 'Category', value: data.category });
    if (data.tags?.length) items.push({ label: 'Tags', value: data.tags.join(', ') });
    if (data.positions?.length) items.push({ label: 'Position(s)', value: data.positions.join(', ') });
    if (data.role) items.push({ label: 'Role', value: data.role });
    if (data.company) items.push({ label: entityType === 'experience' ? 'Company' : 'Organization', value: data.company });
    if (data.location) items.push({ label: 'Location', value: data.location });
    if (data.date) items.push({ label: 'Date', value: data.date });
    if (data.period) items.push({ label: 'Period', value: data.period });
    if (data.achievements?.length) items.push({ label: 'Achievements', value: `${data.achievements.length} item(s)` });
    if (data.images?.length) items.push({ label: 'Images', value: `${data.images.length} uploaded` });
    
    return items;
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setStep('generating');

    try {
      const response = await apiClient.post<{ description: string; success: boolean }>(
        '/ai/generate-description',
        {
          entityType,
          mode,
          data,
          additionalContext: additionalContext.trim() || undefined,
        }
      );

      setGeneratedDescription(response.description);
      setStep('preview');
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate description');
      setStep('context'); // Go back to context step on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = () => {
    onGenerated(generatedDescription);
    handleClose();
  };

  const handleRegenerate = () => {
    setStep('context');
    setGeneratedDescription('');
  };

  const handleClose = () => {
    setStep('idle');
    setAdditionalContext('');
    setGeneratedDescription('');
    setError(null);
  };

  const handleOpenDialog = () => {
    if (!hasMinimumData) {
      setError('Please fill in at least a title before generating');
      return;
    }
    setError(null);
    setStep('context');
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpenDialog}
        disabled={disabled || !hasMinimumData}
        className="gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Generate with AI
      </Button>

      <Dialog open={step !== 'idle'} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-[500px]">
          {step === 'context' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Generate Description
                </DialogTitle>
                <DialogDescription>
                  I'll generate a {mode} description based on the information you've provided.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Data Summary */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Using this information:</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {getDataSummary().map((item, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {item.label}: {item.value.length > 30 ? item.value.slice(0, 30) + '...' : item.value}
                      </Badge>
                    ))}
                    {getDataSummary().length === 0 && (
                      <span className="text-sm text-muted-foreground italic">No data yet</span>
                    )}
                  </div>
                </div>

                {/* Additional Context */}
                <div className="space-y-2">
                  <Label htmlFor="additional-context">Additional context (optional)</Label>
                  <Textarea
                    id="additional-context"
                    placeholder="Add any specific details you want included in the description..."
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleGenerate} disabled={isLoading} className="gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 'generating' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  Generating Description
                </DialogTitle>
                <DialogDescription>
                  Analyzing your content and crafting a {mode} description...
                </DialogDescription>
              </DialogHeader>

              <div className="py-8 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                </div>
                <p className="text-sm text-muted-foreground">This may take a few seconds...</p>
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary" />
                  Generated Description
                </DialogTitle>
                <DialogDescription>
                  Review the generated description below.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                <div className="bg-muted/50 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                  {mode === 'creative' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{generatedDescription}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{generatedDescription}</p>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={handleRegenerate} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </Button>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleAccept} className="gap-2">
                  <Check className="w-4 h-4" />
                  Use This
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DescriptionGenerator;
