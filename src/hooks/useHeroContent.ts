
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { HeroContent } from '@/types/content';

// Fully cut over to the new FastAPI backend (MIGRATION_PLAN.md §7/§11) --
// no Supabase import remains in this file.

const heroStorageKey = (mode: 'professional' | 'creative') => `portfolio_hero_content_${mode}`;

// A returning visitor's last-fetched hero content, used as initialData below
// so the real name/title render on the very first paint instead of Hero.tsx's
// placeholder ("Your Name", "Full Stack Developer...") -- that placeholder is
// meant for a genuinely empty hero_content table, not "still loading".
const saveHeroToLocalStorage = (mode: 'professional' | 'creative', data: HeroContent[]) => {
  try {
    localStorage.setItem(heroStorageKey(mode), JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save hero content to localStorage:', error);
  }
};

const getHeroFromLocalStorage = (mode: 'professional' | 'creative'): HeroContent[] | undefined => {
  try {
    const stored = localStorage.getItem(heroStorageKey(mode));
    return stored ? JSON.parse(stored) : undefined;
  } catch (error) {
    console.error('Failed to read hero content from localStorage:', error);
    return undefined;
  }
};

export const useHeroContent = (mode: 'professional' | 'creative') => {
  return useQuery({
    queryKey: ['hero-content', mode],
    queryFn: async () => {
      const data = await apiClient.get<HeroContent[]>('/hero', { params: { mode } });
      saveHeroToLocalStorage(mode, data);
      return data;
    },
    initialData: () => getHeroFromLocalStorage(mode),
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
