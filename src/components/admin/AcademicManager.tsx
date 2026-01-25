
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, GraduationCap, Award } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import EducationForm from './EducationForm';
import CertificationForm from './CertificationForm';
import { useEducation, useDeleteEducation } from '@/hooks/useEducation';
import { useCertifications, useDeleteCertification } from '@/hooks/useCertifications';
import { Education, Certification } from '@/types/academic';
import { toast } from 'sonner';

const AcademicManager = () => {
  const [activeTab, setActiveTab] = useState('education');
  const [showEducationForm, setShowEducationForm] = useState(false);
  const [showCertificationForm, setShowCertificationForm] = useState(false);
  const [editingEducation, setEditingEducation] = useState<Education | undefined>();
  const [editingCertification, setEditingCertification] = useState<Certification | undefined>();

  const { data: education = [], isLoading: educationLoading } = useEducation();
  const { data: certifications = [], isLoading: certificationsLoading } = useCertifications();
  const deleteEducation = useDeleteEducation();
  const deleteCertification = useDeleteCertification();

  const handleEditEducation = (edu: Education) => {
    setEditingEducation(edu);
    setShowEducationForm(true);
  };

  const handleEditCertification = (cert: Certification) => {
    setEditingCertification(cert);
    setShowCertificationForm(true);
  };

  const handleDeleteEducation = async (id: string) => {
    try {
      await deleteEducation.mutateAsync(id);
      toast.success('Education deleted successfully');
    } catch (error) {
      toast.error('Failed to delete education');
    }
  };

  const handleDeleteCertification = async (id: string) => {
    try {
      await deleteCertification.mutateAsync(id);
      toast.success('Certification deleted successfully');
    } catch (error) {
      toast.error('Failed to delete certification');
    }
  };

  const handleFormSuccess = () => {
    setShowEducationForm(false);
    setShowCertificationForm(false);
    setEditingEducation(undefined);
    setEditingCertification(undefined);
  };

  const handleFormCancel = () => {
    setShowEducationForm(false);
    setShowCertificationForm(false);
    setEditingEducation(undefined);
    setEditingCertification(undefined);
  };

  if (showEducationForm) {
    return (
      <EducationForm
        education={editingEducation}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  if (showCertificationForm) {
    return (
      <CertificationForm
        certification={editingCertification}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Academic Management</h2>
          <p className="text-muted-foreground">Manage education and certifications</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="certifications">Certifications & Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="education" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold flex items-center">
              <GraduationCap className="mr-2" />
              Education ({education.length})
            </h3>
            <Button onClick={() => setShowEducationForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Education
            </Button>
          </div>

          {educationLoading ? (
            <div className="text-center py-8">Loading education...</div>
          ) : education.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No education entries found</p>
                <Button onClick={() => setShowEducationForm(true)} className="mt-4">
                  Add First Education
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {education.map((edu, index) => (
                <motion.div
                  key={edu.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{edu.degree}</CardTitle>
                          <CardDescription>{edu.institution}, {edu.location}</CardDescription>
                          <Badge variant="outline" className="mt-2">{edu.period}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditEducation(edu)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Education</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this education entry? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteEducation(edu.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-3">{edu.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {edu.achievements.map((achievement, achIndex) => (
                          <Badge key={achIndex} variant="secondary">
                            {achievement}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="certifications" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold flex items-center">
              <Award className="mr-2" />
              Certifications & Achievements ({certifications.length})
            </h3>
            <Button onClick={() => setShowCertificationForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Certification/Achievement
            </Button>
          </div>

          {certificationsLoading ? (
            <div className="text-center py-8">Loading certifications & achievements...</div>
          ) : certifications.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No certifications or achievements found</p>
                <Button onClick={() => setShowCertificationForm(true)} className="mt-4">
                  Add First Certification/Achievement
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certifications.map((cert, index) => (
                <motion.div
                  key={cert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{cert.name}</CardTitle>
                          <CardDescription className="flex items-center justify-between">
                            <span>{cert.issuer}</span>
                            <Badge variant="outline">{cert.date}</Badge>
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCertification(cert)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Certification</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this certification? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCertification(cert.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-3">{cert.description}</p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Credential ID:</strong> {cert.credential_id}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AcademicManager;
