
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStats, useCreateStat, useUpdateStat, useDeleteStat } from '@/hooks/useStats';
import { Stat } from '@/types/content';
import { Edit, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { usePortfolio } from '@/contexts/PortfolioContext';

const statSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  value: z.string().min(1, 'Value is required'),
  mode: z.enum(['professional', 'creative']),
  order_index: z.number().min(0),
});

type StatFormData = z.infer<typeof statSchema>;

const StatsManager = () => {
  const { mode } = usePortfolio();
  const { data: stats = [], isLoading } = useStats(mode);
  const createStat = useCreateStat();
  const updateStat = useUpdateStat();
  const deleteStat = useDeleteStat();
  
  const [showForm, setShowForm] = useState(false);
  const [editingStat, setEditingStat] = useState<Stat | null>(null);

  const form = useForm<StatFormData>({
    resolver: zodResolver(statSchema),
    defaultValues: {
      label: '',
      value: '',
      mode: mode,
      order_index: 0,
    },
  });

  const onSubmit = async (data: StatFormData) => {
    try {
      const statData = {
        label: data.label,
        value: data.value,
        mode: data.mode,
        order_index: data.order_index,
      };

      if (editingStat) {
        await updateStat.mutateAsync({ id: editingStat.id, ...statData });
        toast.success('Stat updated successfully');
      } else {
        await createStat.mutateAsync(statData);
        toast.success('Stat created successfully');
      }
      setShowForm(false);
      setEditingStat(null);
      form.reset();
    } catch (error) {
      toast.error('Failed to save stat');
      console.error('Error saving stat:', error);
    }
  };

  const handleEdit = (stat: Stat) => {
    setEditingStat(stat);
    form.reset({
      label: stat.label,
      value: stat.value,
      mode: stat.mode,
      order_index: stat.order_index,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this stat?')) {
      try {
        await deleteStat.mutateAsync(id);
        toast.success('Stat deleted successfully');
      } catch (error) {
        toast.error('Failed to delete stat');
        console.error('Error deleting stat:', error);
      }
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Stats Management</CardTitle>
          <CardDescription>
            Editing <strong className="capitalize">{mode}</strong> mode stats. Use mode toggle (bottom left) to switch.
          </CardDescription>
        </div>
        <div className="flex gap-4 mt-4">
          <Button onClick={() => setShowForm(true)} className="w-fit">
            <Plus className="w-4 h-4 mr-2" />
            Add Stat
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="mb-6 p-4 border rounded-lg">
            <h3 className="text-lg font-semibold mb-4">
              {editingStat ? 'Edit Stat' : 'Add Stat'}
            </h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label</FormLabel>
                      <FormControl>
                        <Input placeholder="Projects Completed" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value</FormLabel>
                      <FormControl>
                        <Input placeholder="50+" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="creative">Creative</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="order_index"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Index</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button type="submit" disabled={createStat.isPending || updateStat.isPending}>
                    {createStat.isPending || updateStat.isPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowForm(false);
                      setEditingStat(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((stat) => (
              <TableRow key={stat.id}>
                <TableCell className="font-medium">{stat.label}</TableCell>
                <TableCell>{stat.value}</TableCell>
                <TableCell className="capitalize">{stat.mode}</TableCell>
                <TableCell>{stat.order_index}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(stat)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(stat.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default StatsManager;
