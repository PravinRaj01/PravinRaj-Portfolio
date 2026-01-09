
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { ContactContent } from '@/types/content';

export const useContactContent = (mode: 'professional' | 'creative') => {
  return useQuery({
    queryKey: ['contact-content', mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_content')
        .select('*')
        .eq('mode', mode)
        .single();
      
      if (error) throw error;
      return data as ContactContent;
    },
  });
};

export const useUpdateContactContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (content: Omit<ContactContent, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('contact_content')
        .upsert(content, { onConflict: 'mode' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contact-content', data.mode] });
    },
  });
};
