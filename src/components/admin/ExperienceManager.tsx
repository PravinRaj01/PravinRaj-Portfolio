
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Calendar, MapPin, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useExperience } from '@/hooks/useExperience';
import { Experience } from '@/types/cms';
import ExperienceForm from './ExperienceForm';
import { usePortfolio } from '@/contexts/PortfolioContext';

const ExperienceManager = () => {
  const { mode } = usePortfolio();
  const { experiences, loading, addExperience, updateExperience, deleteExperience } = useExperience(mode);
  const [showForm, setShowForm] = useState(false);
  const [editingExperience, setEditingExperience] = useState<Experience | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      const experienceData = { ...data, mode: mode };
      if (editingExperience) {
        await updateExperience(editingExperience.id, experienceData);
      } else {
        await addExperience(experienceData);
      }
      setShowForm(false);
      setEditingExperience(null);
    } catch (error) {
      console.error('Failed to save experience:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (experience: Experience) => {
    setEditingExperience(experience);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this experience?')) {
      try {
        await deleteExperience(id);
      } catch (error) {
        console.error('Failed to delete experience:', error);
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingExperience(null);
  };

  if (loading) {
    return <div className="text-center py-8">Loading experiences...</div>;
  }

  if (showForm) {
    return (
      <ExperienceForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        initialData={editingExperience || undefined}
        loading={submitting}
        mode={mode}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Experience</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Showing <strong className="capitalize">{mode}</strong> mode experiences. Use mode toggle (bottom left) to switch.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Experience
        </Button>
      </div>

      <div className="space-y-4">
        {experiences.map((experience) => (
          <motion.div
            key={experience.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group"
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{experience.title}</CardTitle>
                    <CardDescription className="space-y-1">
                      <div className="flex items-center text-base">
                        <Building2 className="w-4 h-4 mr-1" />
                        {experience.company}
                        <MapPin className="w-4 h-4 ml-4 mr-1" />
                        {experience.location}
                      </div>
                      <div className="flex items-center text-primary">
                        <Calendar className="w-4 h-4 mr-1" />
                        {experience.period}
                      </div>
                    </CardDescription>
                  </div>
                  
                  <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(experience)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(experience.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <p className="text-muted-foreground mb-4">{experience.description}</p>
                <div className="flex flex-wrap gap-2">
                  {experience.achievements.map((achievement, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {achievement}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {experiences.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">No experiences found for {mode} mode</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Experience
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExperienceManager;
