
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { ContactContent } from '@/types/content';

export const useContactContent = (mode: 'professional' | 'creative') => {
  return useQuery({
    queryKey: ['contact-content', mode],
    queryFn: async () => {
      return apiClient.get<ContactContent>(`/contact/${mode}`);
    },
  });
};

export const useUpdateContactContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: Omit<ContactContent, 'id' | 'created_at' | 'updated_at'>) => {
      // PUT /contact/{mode} upserts (INSERT ... ON CONFLICT (mode) DO
      // UPDATE), matching the old .upsert(content, { onConflict: 'mode' }).
      return apiClient.put<ContactContent>(`/contact/${content.mode}`, content);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contact-content', data.mode] });
    },
  });
};
