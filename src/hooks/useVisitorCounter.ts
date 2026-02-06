import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

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

        if (!hasBeenTracked) {
          // Increment visitor count via edge function
          const { data, error } = await supabase.functions.invoke('track-visitor', {
            body: { action: 'increment' }
          });

          if (!error && data) {
            setTotalCount(data.count || 0);
            setTodayCount(data.todayCount || 0);
            sessionStorage.setItem(VISITOR_TRACKED_KEY, 'true');
          }
        } else {
          // Just fetch current count
          const { data, error } = await supabase.functions.invoke('track-visitor', {
            body: { action: 'get' }
          });

          if (!error && data) {
            setTotalCount(data.count || 0);
            setTodayCount(data.todayCount || 0);
          }
        }
      } catch (error) {
        console.error('Error tracking visitor:', error);
        // Fallback: try to fetch from database directly
        const today = new Date().toISOString().split('T')[0];
        
        const [totalResult, dailyResult] = await Promise.all([
          supabase.from('visitor_stats').select('view_count').limit(1).single(),
          supabase.from('visitor_daily_stats').select('view_count').eq('date', today).single()
        ]);
        
        if (totalResult.data?.view_count) {
          setTotalCount(totalResult.data.view_count);
        }
        if (dailyResult.data?.view_count) {
          setTodayCount(dailyResult.data.view_count);
        }
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
