
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { Certification } from '@/types/academic';

export const useCertifications = () => {
  return useQuery({
    queryKey: ['certifications'],
    queryFn: async () => {
      return apiClient.get<Certification[]>('/certifications');
    },
  });
};

export const useCreateCertification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (certification: Omit<Certification, 'id' | 'created_at' | 'updated_at'>) => {
      return apiClient.post<Certification>('/certifications', certification);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications'] });
    },
  });
};

export const useUpdateCertification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...certification }: Partial<Certification> & { id: string }) => {
      return apiClient.patch<Certification>(`/certifications/${id}`, certification);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications'] });
    },
  });
};

export const useDeleteCertification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/certifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications'] });
    },
  });
};
