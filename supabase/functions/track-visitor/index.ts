import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, delayMs = 500): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === maxRetries) throw e;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Unreachable');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action } = await req.json().catch(() => ({ action: 'get' }));
    const today = new Date().toISOString().split('T')[0];

    if (action === 'increment') {
      console.log('Incrementing visitor count...');

      const currentStats = await withRetry(async () => {
        const { data, error } = await supabase.from('visitor_stats').select('*').limit(1).single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
      });

      let newTotalCount = 1;

      if (currentStats) {
        newTotalCount = (currentStats.view_count || 0) + 1;
        await withRetry(async () => {
          const { error } = await supabase.from('visitor_stats').update({ view_count: newTotalCount, last_updated: new Date().toISOString() }).eq('id', currentStats.id);
          if (error) throw error;
        });
      } else {
        await withRetry(async () => {
          const { error } = await supabase.from('visitor_stats').insert({ view_count: 1 });
          if (error) throw error;
        });
      }

      let newDailyCount = 1;
      try {
        const todayData = await withRetry(async () => {
          const { data, error } = await supabase.from('visitor_daily_stats').select('*').eq('date', today).single();
          if (error && error.code === 'PGRST116') return null;
          if (error) throw error;
          return data;
        });

        if (!todayData) {
          await withRetry(async () => {
            const { error } = await supabase.from('visitor_daily_stats').insert({ date: today, view_count: 1 });
            if (error) throw error;
          });
        } else {
          newDailyCount = (todayData.view_count || 0) + 1;
          await withRetry(async () => {
            const { error } = await supabase.from('visitor_daily_stats').update({ view_count: newDailyCount }).eq('id', todayData.id);
            if (error) throw error;
          });
        }
      } catch (dailyErr) {
        console.error('Daily stats error (non-fatal):', dailyErr);
      }

      console.log(`Visitor counted. Total: ${newTotalCount}, Today: ${newDailyCount}`);

      return new Response(
        JSON.stringify({ success: true, count: newTotalCount, todayCount: newDailyCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: get current counts
    const [totalResult, dailyResult] = await Promise.all([
      withRetry(async () => {
        const { data, error } = await supabase.from('visitor_stats').select('view_count').limit(1).single();
        return { data, error };
      }),
      withRetry(async () => {
        const { data, error } = await supabase.from('visitor_daily_stats').select('view_count').eq('date', today).single();
        return { data, error };
      })
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        count: totalResult.data?.view_count || 0,
        todayCount: dailyResult.data?.view_count || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in track-visitor:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
