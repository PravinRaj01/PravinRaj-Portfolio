import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, TrendingUp, Calendar, Users } from 'lucide-react';
import { useSiteSettings, useUpdateSiteSettings } from '@/hooks/useSiteSettings';
import { useVisitorCounter } from '@/hooks/useVisitorCounter';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

type TimeRange = '7days' | '30days' | 'all';

interface VisitorDailyStat {
  id: string;
  date: string;
  view_count: number;
  created_at: string | null;
}

const VisitorStatsManager = () => {
  const { data: settings, isLoading: settingsLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const { totalCount: totalVisitors, todayCount: todayVisitors, isLoading: countLoading } = useVisitorCounter();
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');

  // Fetch daily stats
  const { data: dailyStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ['visitor-daily-stats', timeRange],
    queryFn: async () => {
      return apiClient.get<VisitorDailyStat[]>('/visitors/daily', { params: { range: timeRange } });
    },
  });

  // Calculate stats
  const stats = useMemo(() => {
    if (dailyStats.length === 0) {
      return { todayCount: 0, weeklyAvg: 0, trend: 0 };
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const todayData = dailyStats.find(d => d.date === today);
    const todayCount = todayData?.view_count || 0;

    const totalInRange = dailyStats.reduce((sum, d) => sum + (d.view_count || 0), 0);
    const weeklyAvg = Math.round(totalInRange / Math.max(dailyStats.length, 1));

    const last7Days = dailyStats.slice(-7);
    const prev7Days = dailyStats.slice(-14, -7);
    const last7Total = last7Days.reduce((sum, d) => sum + (d.view_count || 0), 0);
    const prev7Total = prev7Days.reduce((sum, d) => sum + (d.view_count || 0), 0);
    const trend = prev7Total > 0 ? Math.round(((last7Total - prev7Total) / prev7Total) * 100) : 0;

    return { todayCount, weeklyAvg, trend };
  }, [dailyStats]);

  // Format chart data
  const chartData = useMemo(() => {
    return dailyStats.map(d => ({
      date: format(new Date(d.date), 'MMM dd'),
      visitors: d.view_count || 0,
    }));
  }, [dailyStats]);

  const handleToggle = async (field: string, enabled: boolean) => {
    try {
      await updateSettings.mutateAsync({
        ...settings,
        site_name: settings?.site_name || 'Portfolio',
        [field]: enabled,
      });
      toast.success(`Setting updated`);
    } catch (error) {
      toast.error('Failed to update setting');
    }
  };

  if (settingsLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Toggles Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visitor Counter Settings
          </CardTitle>
          <CardDescription>
            Control what visitor info is displayed on your website's navigation bar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Master toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Visitor Counter</Label>
              <p className="text-sm text-muted-foreground">
                Show the visitor count icon in the navigation bar
              </p>
            </div>
            <Switch
              checked={settings?.visitor_counter_enabled ?? false}
              onCheckedChange={(v) => handleToggle('visitor_counter_enabled', v)}
              disabled={updateSettings.isPending}
            />
          </div>

          {/* Show total visitors toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4 ml-4">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Show Total Visitors
              </Label>
              <p className="text-sm text-muted-foreground">
                Display the all-time total visitor count in the popup
              </p>
            </div>
            <Switch
              checked={settings?.show_total_visitors ?? true}
              onCheckedChange={(v) => handleToggle('show_total_visitors', v)}
              disabled={updateSettings.isPending || !settings?.visitor_counter_enabled}
            />
          </div>

          {/* Show daily visitors toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4 ml-4">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Show Daily Visitors
              </Label>
              <p className="text-sm text-muted-foreground">
                Display today's visitor count in the popup
              </p>
            </div>
            <Switch
              checked={settings?.show_daily_visitors ?? true}
              onCheckedChange={(v) => handleToggle('show_daily_visitors', v)}
              disabled={updateSettings.isPending || !settings?.visitor_counter_enabled}
            />
          </div>

          {/* How it works */}
          <div className="rounded-lg border border-dashed p-4 bg-muted/30">
            <p className="text-sm font-medium mb-2">How visitor counting works</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Each browser session is counted once (using <code>sessionStorage</code>)</li>
              <li>Opening a new tab or closing/reopening the browser creates a new session</li>
              <li>Refreshing the same tab does <strong>not</strong> count again</li>
              <li>It is <strong>not</strong> IP-based — same person on different browsers/devices counts separately</li>
              <li>Daily counts reset at midnight UTC</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Visitors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {countLoading ? '...' : totalVisitors.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {countLoading ? '...' : todayVisitors.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Visitors today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trend</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {statsLoading ? '...' : `${stats.trend >= 0 ? '+' : ''}${stats.trend}%`}
            </div>
            <p className="text-xs text-muted-foreground">vs previous week</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Visitor Trends</CardTitle>
              <CardDescription>Daily visitor count over time</CardDescription>
            </div>
            <div className="flex gap-2">
              {(['7days', '30days', 'all'] as TimeRange[]).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                >
                  {range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : 'All Time'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">Loading chart...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">No data yet. Visitors will be tracked once the counter is enabled.</p>
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs fill-muted-foreground" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs fill-muted-foreground" tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="visitors"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorVisitors)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VisitorStatsManager;
