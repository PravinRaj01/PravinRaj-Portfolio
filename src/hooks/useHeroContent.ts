
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { HeroContent } from '@/types/content';

// Fully cut over to the new FastAPI backend (MIGRATION_PLAN.md §7/§11) --
// no Supabase import remains in this file.
export const useHeroContent = (mode: 'professional' | 'creative') => {
  return useQuery({
    queryKey: ['hero-content', mode],
    queryFn: async () => {
      return apiClient.get<HeroContent[]>('/hero', { params: { mode } });
    },
  });
};

export const useCreateHeroContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: Omit<HeroContent, 'id' | 'created_at' | 'updated_at'>) => {
      return apiClient.post<HeroContent>('/hero', content);
    },
    onSuccess: (data) => {
      // Invalidate queries for the specific mode
      queryClient.invalidateQueries({ queryKey: ['hero-content', data.mode] });
      // Also invalidate all hero-content queries to be safe
      queryClient.invalidateQueries({ queryKey: ['hero-content'] });
    },
  });
};

export const useUpdateHeroContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...content }: Partial<HeroContent> & { id: string }) => {
      return apiClient.patch<HeroContent>(`/hero/${id}`, content);
    },
    onSuccess: (data) => {
      // Invalidate queries for the specific mode
      queryClient.invalidateQueries({ queryKey: ['hero-content', data.mode] });
      // Also invalidate all hero-content queries to be safe
      queryClient.invalidateQueries({ queryKey: ['hero-content'] });
    },
  });
};
