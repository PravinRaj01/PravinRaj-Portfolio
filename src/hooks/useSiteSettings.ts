
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { SiteSettings } from '@/types/content';

const SETTINGS_STORAGE_KEY = 'portfolio_site_settings';

// Helper functions for localStorage
const saveToLocalStorage = (data: SiteSettings) => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error);
  }
};

const getFromLocalStorage = (): SiteSettings | null => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to get settings from localStorage:', error);
    return null;
  }
};

export const useSiteSettings = () => {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      console.log('Fetching site settings...');
      try {
        const data = await apiClient.get<SiteSettings>('/site-settings');
        console.log('Site settings fetched:', data);
        // Save to localStorage for persistence
        saveToLocalStorage(data);
        return data;
      } catch (error) {
        console.log('Error fetching from database, checking localStorage...');
        const localData = getFromLocalStorage();
        if (localData) {
          console.log('Using localStorage data:', localData);
          return localData;
        }
        throw error;
      }
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Add initialData from localStorage if available
    initialData: () => getFromLocalStorage(),
  });
};

export const useUpdateSiteSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: Omit<SiteSettings, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => {
      console.log('Updating site settings:', settings);
      // PUT /site-settings upserts the singleton row directly -- no id
      // lookup needed, the backend finds (or creates) the one row itself.
      const { id: _id, ...payload } = settings;
      const data = await apiClient.put<SiteSettings>('/site-settings', payload);
      console.log('Site settings updated:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('Mutation successful, updating cache and localStorage...');
      // Save to localStorage immediately
      saveToLocalStorage(data);
      // Update cache
      queryClient.setQueryData(['site-settings'], data);
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    },
  });
};
