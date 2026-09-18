import { useEffect, useState } from 'react';
import { apiClient } from '@/services/apiClient';

const VISITOR_TRACKED_KEY = 'portfolio_visitor_tracked';

interface VisitorStats {
  totalCount: number;
  todayCount: number;
  isLoading: boolean;
}

export const useVisitorCounter = (): VisitorStats => {
  const [totalCount, setTotalCount] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const trackAndFetch = async () => {
      try {
        const hasBeenTracked = sessionStorage.getItem(VISITOR_TRACKED_KEY);

        // Reads/increments via the FastAPI backend (MIGRATION_PLAN.md §7);
        // POST /visitors/increment is atomic (no read-modify-write race like
        // the old Edge Function had).
        if (!hasBeenTracked) {
          const data = await apiClient.post<{ count: number; todayCount: number }>(
            '/visitors/increment'
          );
          setTotalCount(data.count || 0);
          setTodayCount(data.todayCount || 0);
          sessionStorage.setItem(VISITOR_TRACKED_KEY, 'true');
        } else {
          const data = await apiClient.get<{ count: number; todayCount: number }>('/visitors');
          setTotalCount(data.count || 0);
          setTodayCount(data.todayCount || 0);
        }
      } catch (error) {
        console.error('Error tracking visitor:', error);
      } finally {
        setIsLoading(false);
      }
    };

    trackAndFetch();
  }, []);

  // Keep legacy 'count' for backwards compatibility
  return { 
    totalCount, 
    todayCount, 
    isLoading,
    // @ts-ignore - backwards compatibility
    get count() { return this.totalCount; }
  };
};
