
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { AboutContent } from '@/types/content';

// Fully cut over to the new FastAPI backend (MIGRATION_PLAN.md §7/§11) --
// no Supabase import remains in this file.
export const useAboutContent = (mode: 'professional' | 'creative') => {
  return useQuery({
    queryKey: ['about-content', mode],
    queryFn: async () => {
      return apiClient.get<AboutContent[]>('/about', { params: { mode } });
    },
  });
};

export const useCreateAboutContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: Omit<AboutContent, 'id' | 'created_at' | 'updated_at'>) => {
      return apiClient.post<AboutContent>('/about', content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['about-content'] });
    },
  });
};

export const useUpdateAboutContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...content }: Partial<AboutContent> & { id: string }) => {
      return apiClient.patch<AboutContent>(`/about/${id}`, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['about-content'] });
    },
  });
};

export const useDeleteAboutContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/about/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['about-content'] });
    },
  });
};
