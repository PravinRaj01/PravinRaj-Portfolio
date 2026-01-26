import React, { useState, useMemo } from 'react';
import { useProjectFolders, ProjectFolder } from '@/hooks/useProjectFolders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Folder, Edit, Trash2, GripVertical, Search } from 'lucide-react';
import { toast } from 'sonner';
import ProjectFolderForm from './ProjectFolderForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ProjectFolderManager = () => {
  const [activeMode, setActiveMode] = useState<'professional' | 'creative'>('professional');
  const { folders, loading, addFolder, updateFolder, deleteFolder, refetch } = useProjectFolders(activeMode);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ProjectFolder | null>(null);
  const [deleteConfirmFolder, setDeleteConfirmFolder] = useState<ProjectFolder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter folders by search
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const query = searchQuery.toLowerCase();
    return folders.filter(folder =>
      folder.name.toLowerCase().includes(query) ||
      folder.description?.toLowerCase().includes(query)
    );
  }, [folders, searchQuery]);

  const handleAddFolder = () => {
    setEditingFolder(null);
    setIsFormOpen(true);
  };

  const handleEditFolder = (folder: ProjectFolder) => {
    setEditingFolder(folder);
    setIsFormOpen(true);
  };

  const handleSaveFolder = async (folderData: Omit<ProjectFolder, 'id' | 'created_at' | 'updated_at' | 'project_count'>) => {
    try {
      if (editingFolder) {
        await updateFolder(editingFolder.id, folderData);
        toast.success('Folder updated successfully');
      } else {
        await addFolder(folderData);
        toast.success('Folder created successfully');
      }
      setIsFormOpen(false);
      setEditingFolder(null);
    } catch (error) {
      toast.error(editingFolder ? 'Failed to update folder' : 'Failed to create folder');
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteConfirmFolder) return;
    try {
      await deleteFolder(deleteConfirmFolder.id);
      toast.success('Folder deleted successfully');
      setDeleteConfirmFolder(null);
    } catch (error) {
      toast.error('Failed to delete folder');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Project Folders</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
          <Button onClick={handleAddFolder}>
            <Plus className="w-4 h-4 mr-2" />
            Add Folder
          </Button>
        </div>
      </div>

      <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'professional' | 'creative')}>
        <TabsList>
          <TabsTrigger value="professional">Professional</TabsTrigger>
          <TabsTrigger value="creative">Creative</TabsTrigger>
        </TabsList>

        <TabsContent value={activeMode} className="mt-4">
          {filteredFolders.length === 0 && folders.length > 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No folders match your search.
                </p>
                <Button variant="outline" onClick={() => setSearchQuery('')} className="mt-4">
                  Clear Search
                </Button>
              </CardContent>
            </Card>
          ) : filteredFolders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Folder className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No folders yet. Create a folder to organize your {activeMode} projects.
                </p>
                <Button onClick={handleAddFolder} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Folder
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredFolders.map((folder) => (
                <Card key={folder.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
                      <Folder className={`w-8 h-8 ${activeMode === 'creative' ? 'text-orange-500' : 'text-purple-500'}`} />
                      <div>
                        <h3 className="font-semibold">{folder.name}</h3>
                        {folder.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{folder.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">
                        {folder.project_count} project{folder.project_count !== 1 ? 's' : ''}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => handleEditFolder(folder)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setDeleteConfirmFolder(folder)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Folder Form Dialog */}
      <ProjectFolderForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        folder={editingFolder}
        mode={activeMode}
        onSave={handleSaveFolder}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmFolder} onOpenChange={() => setDeleteConfirmFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmFolder?.name}"? 
              {deleteConfirmFolder?.project_count ? (
                <span className="block mt-2 font-medium text-amber-600">
                  This folder contains {deleteConfirmFolder.project_count} project(s). 
                  Projects will be moved out of the folder, not deleted.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectFolderManager;
