import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, X } from 'lucide-react';
import { useSkills, useCreateSkill, useUpdateSkill, useDeleteSkill } from '@/hooks/useSkills';
import { Skill } from '@/types/content';
import { toast } from 'sonner';
import { usePortfolio } from '@/contexts/PortfolioContext';

const skillSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  icon: z.string().min(1, 'Icon is required'),
  skills: z.array(z.string()).min(1, 'At least one skill is required'),
  color: z.string().min(1, 'Color is required'),
  mode: z.enum(['professional', 'creative']),
  order_index: z.number().min(0),
});

type SkillFormData = z.infer<typeof skillSchema>;

const SkillsManager = () => {
  const { mode } = usePortfolio();
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  const { data: skills = [] } = useSkills(mode);
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const deleteSkill = useDeleteSkill();

  const form = useForm<SkillFormData>({
    resolver: zodResolver(skillSchema),
    defaultValues: {
      category: '',
      icon: '',
      skills: [],
      color: '',
      mode: mode,
      order_index: 0,
    },
  });

  const onSubmit = async (data: SkillFormData) => {
    try {
      const skillData = {
        category: data.category,
        icon: data.icon,
        skills: data.skills,
        color: data.color,
        mode: data.mode,
        order_index: data.order_index,
      };

      if (editingSkill) {
        await updateSkill.mutateAsync({ id: editingSkill.id, ...skillData });
        toast.success('Skill updated successfully');
      } else {
        await createSkill.mutateAsync(skillData);
        toast.success('Skill created successfully');
      }
      setShowForm(false);
      setEditingSkill(null);
      form.reset();
    } catch (error) {
      toast.error('Failed to save skill');
      console.error('Error saving skill:', error);
    }
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    form.reset(skill);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSkill.mutateAsync(id);
      toast.success('Skill deleted successfully');
    } catch (error) {
      toast.error('Failed to delete skill');
      console.error('Error deleting skill:', error);
    }
  };

  const handleAdd = () => {
    setEditingSkill(null);
    form.reset({
      category: '',
      icon: '',
      skills: [],
      color: '',
      mode: mode,
      order_index: skills.length,
    });
    setShowForm(true);
  };

  const addSkillToForm = () => {
    if (newSkill.trim()) {
      const currentSkills = form.getValues('skills');
      form.setValue('skills', [...currentSkills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkillFromForm = (index: number) => {
    const currentSkills = form.getValues('skills');
    form.setValue('skills', currentSkills.filter((_, i) => i !== index));
  };

  const colorOptions = [
    { value: 'from-blue-500 to-cyan-500', label: 'Blue to Cyan' },
    { value: 'from-green-500 to-emerald-500', label: 'Green to Emerald' },
    { value: 'from-purple-500 to-pink-500', label: 'Purple to Pink' },
    { value: 'from-orange-500 to-red-500', label: 'Orange to Red' },
    { value: 'from-pink-500 to-rose-500', label: 'Pink to Rose' },
    { value: 'from-blue-500 to-indigo-500', label: 'Blue to Indigo' },
    { value: 'from-green-500 to-teal-500', label: 'Green to Teal' },
    { value: 'from-purple-500 to-violet-500', label: 'Purple to Violet' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Skills Management</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Editing <strong className="capitalize">{mode}</strong> mode skills. Use mode toggle (bottom left) to switch.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Skill Category
        </Button>
      </div>

      {/* Existing Skills */}
      <div className="grid gap-4">
        {skills.map((skill) => (
          <Card key={skill.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{skill.category}</CardTitle>
                  <Badge variant="outline">{skill.mode}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(skill)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(skill.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {skill.skills.map((s, index) => (
                  <Badge key={index} variant="secondary">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingSkill ? 'Edit Skill Category' : 'Add Skill Category'}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Frontend Development" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon (Lucide React)</FormLabel>
                      <FormControl>
                        <Input placeholder="Code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color Gradient</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {colorOptions.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              {color.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <FormLabel>Skills</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add skill..."
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkillToForm())}
                    />
                    <Button type="button" onClick={addSkillToForm} size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.watch('skills').map((skill, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkillFromForm(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  {form.formState.errors.skills && (
                    <p className="text-sm text-destructive">{form.formState.errors.skills.message}</p>
                  )}
                </div>

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
                  <Button type="submit" disabled={createSkill.isPending || updateSkill.isPending}>
                    {editingSkill ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SkillsManager;
