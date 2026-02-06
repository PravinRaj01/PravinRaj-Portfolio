import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

      // 1. Increment total visitor count
      const { data: currentStats, error: fetchError } = await supabase
        .from('visitor_stats')
        .select('*')
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      let newTotalCount = 1;

      if (currentStats) {
        newTotalCount = (currentStats.view_count || 0) + 1;
        const { error: updateError } = await supabase
          .from('visitor_stats')
          .update({ view_count: newTotalCount, last_updated: new Date().toISOString() })
          .eq('id', currentStats.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('visitor_stats')
          .insert({ view_count: 1 });
        if (insertError) throw insertError;
      }

      // 2. Increment daily visitor count (upsert for today)
      const { data: todayData, error: todayFetchError } = await supabase
        .from('visitor_daily_stats')
        .select('*')
        .eq('date', today)
        .single();

      let newDailyCount = 1;

      if (todayFetchError && todayFetchError.code === 'PGRST116') {
        // No row for today yet - insert
        const { error: insertDailyError } = await supabase
          .from('visitor_daily_stats')
          .insert({ date: today, view_count: 1 });
        if (insertDailyError) {
          console.error('Failed to insert daily stats:', insertDailyError);
        }
      } else if (!todayFetchError && todayData) {
        // Row exists - update
        newDailyCount = (todayData.view_count || 0) + 1;
        const { error: updateDailyError } = await supabase
          .from('visitor_daily_stats')
          .update({ view_count: newDailyCount })
          .eq('id', todayData.id);
        if (updateDailyError) {
          console.error('Failed to update daily stats:', updateDailyError);
        }
      }

      console.log(`Visitor counted. Total: ${newTotalCount}, Today: ${newDailyCount}`);

      return new Response(
        JSON.stringify({ success: true, count: newTotalCount, todayCount: newDailyCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: just get the current counts
    const [totalResult, dailyResult] = await Promise.all([
      supabase.from('visitor_stats').select('view_count').limit(1).single(),
      supabase.from('visitor_daily_stats').select('view_count').eq('date', today).single()
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
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
