import React from 'react';
import { useForm } from 'react-hook-form';
import { ProjectFolder } from '@/hooks/useProjectFolders';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface ProjectFolderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: ProjectFolder | null;
  mode: 'professional' | 'creative';
  onSave: (data: Omit<ProjectFolder, 'id' | 'created_at' | 'updated_at' | 'project_count'>) => void;
}

interface FormData {
  name: string;
  description: string;
  cover_image_drive_id: string;
}

const ProjectFolderForm: React.FC<ProjectFolderFormProps> = ({
  open,
  onOpenChange,
  folder,
  mode,
  onSave,
}) => {
  const form = useForm<FormData>({
    defaultValues: {
      name: folder?.name || '',
      description: folder?.description || '',
      cover_image_drive_id: folder?.cover_image_drive_id || '',
    },
  });

  React.useEffect(() => {
    if (folder) {
      form.reset({
        name: folder.name,
        description: folder.description || '',
        cover_image_drive_id: folder.cover_image_drive_id || '',
      });
    } else {
      form.reset({
        name: '',
        description: '',
        cover_image_drive_id: '',
      });
    }
  }, [folder, form]);

  const handleSubmit = (data: FormData) => {
    onSave({
      name: data.name,
      description: data.description || null,
      cover_image_drive_id: data.cover_image_drive_id || null,
      mode,
      order_index: folder?.order_index ?? 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {folder ? 'Edit Folder' : 'Create Folder'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: 'Folder name is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter folder name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief description of this folder" 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cover_image_drive_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cover Image Drive ID (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Google Drive image ID or URL" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {folder ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectFolderForm;
