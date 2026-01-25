
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { HeroContent } from '@/types/content';

export const useHeroContent = (mode: 'professional' | 'creative') => {
  return useQuery({
    queryKey: ['hero-content', mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hero_content')
        .select('*')
        .eq('mode', mode)
        .order('order_index');
      
      if (error) throw error;
      return data as HeroContent[];
    },
  });
};

export const useCreateHeroContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (content: Omit<HeroContent, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('hero_content')
        .insert(content)
        .select()
        .single();
      
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase
        .from('hero_content')
        .update(content)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate queries for the specific mode
      queryClient.invalidateQueries({ queryKey: ['hero-content', data.mode] });
      // Also invalidate all hero-content queries to be safe
      queryClient.invalidateQueries({ queryKey: ['hero-content'] });
    },
  });
};
