
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Certification } from '@/types/academic';
import { useCreateCertification, useUpdateCertification } from '@/hooks/useCertifications';
import { toast } from 'sonner';
import { SingleDatePicker } from '@/components/ui/date-range-picker';

const certificationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  issuer: z.string().min(1, 'Issuer is required'),
  date: z.string().min(1, 'Date is required'),
  credential_id: z.string().optional(),
  credential_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  description: z.string().min(1, 'Description is required'),
});

type CertificationFormData = z.infer<typeof certificationSchema>;

interface CertificationFormProps {
  certification?: Certification;
  onSuccess: () => void;
  onCancel: () => void;
}

const CertificationForm = ({ certification, onSuccess, onCancel }: CertificationFormProps) => {
  const createCertification = useCreateCertification();
  const updateCertification = useUpdateCertification();

  const form = useForm<CertificationFormData>({
    resolver: zodResolver(certificationSchema),
    defaultValues: {
      name: certification?.name || '',
      issuer: certification?.issuer || '',
      date: certification?.date || '',
      credential_id: certification?.credential_id || '',
      credential_url: certification?.credential_url || '',
      description: certification?.description || '',
    },
  });

  const onSubmit = async (data: CertificationFormData) => {
    try {
      // Ensure all required fields are present
      // Use null instead of undefined to properly clear optional fields in the database
      const certificationData = {
        name: data.name,
        issuer: data.issuer,
        date: data.date,
        credential_id: data.credential_id?.trim() || null,
        credential_url: data.credential_url?.trim() || null,
        description: data.description,
        order_index: 0, // Default order, sorting is by date
      };

      if (certification) {
        await updateCertification.mutateAsync({ id: certification.id, ...certificationData });
        toast.success('Certification updated successfully');
      } else {
        await createCertification.mutateAsync(certificationData);
        toast.success('Certification created successfully');
      }
      onSuccess();
    } catch (error) {
      toast.error('Failed to save certification');
      console.error('Error saving certification:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{certification ? 'Edit Certification' : 'Add Certification'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., AWS Certified Solutions Architect" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="issuer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issuer</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Amazon Web Services" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <SingleDatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select certification date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="credential_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credential ID (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., AWS-SA-2023-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="credential_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credential URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., https://www.credly.com/badges/..." {...field} />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Description of the certification..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={createCertification.isPending || updateCertification.isPending}
              >
                {certification ? 'Update' : 'Create'} Certification
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default CertificationForm;
