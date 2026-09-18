
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { Education } from '@/types/academic';

export const useEducation = () => {
  return useQuery({
    queryKey: ['education'],
    queryFn: async () => {
      return apiClient.get<Education[]>('/education');
    },
  });
};

export const useCreateEducation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (education: Omit<Education, 'id' | 'created_at' | 'updated_at'>) => {
      return apiClient.post<Education>('/education', education);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education'] });
    },
  });
};

export const useUpdateEducation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...education }: Partial<Education> & { id: string }) => {
      return apiClient.patch<Education>(`/education/${id}`, education);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education'] });
    },
  });
};

export const useDeleteEducation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/education/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education'] });
    },
  });
};
