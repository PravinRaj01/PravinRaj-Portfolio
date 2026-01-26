import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

export interface GithubTickerContent {
  id: string;
  text: string;
  url: string;
  mode: string;
  created_at: string;
  updated_at: string;
}

export const useGithubTicker = (mode: 'professional' | 'creative' = 'professional') => {
  return useQuery({
    queryKey: ['github-ticker', mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('github_ticker')
        .select('*')
        .eq('mode', mode)
        .maybeSingle();
      
      if (error) throw error;
      return data as GithubTickerContent | null;
    },
  });
};

export const useUpdateGithubTicker = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, text, url }: { id: string; text: string; url: string }) => {
      const { data, error } = await supabase
        .from('github_ticker')
        .update({ text, url, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate both modes to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['github-ticker'] });
    },
  });
};
