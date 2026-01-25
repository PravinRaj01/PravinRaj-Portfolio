import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

export interface GithubTickerContent {
  id: string;
  text: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export const useGithubTicker = () => {
  return useQuery({
    queryKey: ['github-ticker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('github_ticker')
        .select('*')
        .limit(1)
        .single();
      
      if (error) throw error;
      return data as GithubTickerContent;
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-ticker'] });
    },
  });
};
