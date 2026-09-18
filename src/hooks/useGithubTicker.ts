import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

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
      // GET /github-ticker/{mode} returns a null body (not 404) when
      // absent, matching Supabase's .maybeSingle() -- apiClient.get
      // resolves that straight to null.
      return apiClient.get<GithubTickerContent | null>(`/github-ticker/${mode}`);
    },
  });
};

export const useUpdateGithubTicker = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, text, url }: { id: string; text: string; url: string }) => {
      return apiClient.patch<GithubTickerContent>(`/github-ticker/${id}`, { text, url });
    },
    onSuccess: () => {
      // Invalidate both modes to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['github-ticker'] });
    },
  });
};
