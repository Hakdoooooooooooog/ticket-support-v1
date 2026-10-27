'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@ui/card';
import { Input } from '@ui/input';
import { Textarea } from '@ui/textarea';
import { Label } from '@ui/label';

const ticketSchema = z.object({
  title: z
    .string()
    .min(5, { message: 'Title must be at least 5 characters long' })
    .max(100, { message: 'Title cannot exceed 100 characters' }),
  description: z
    .string()
    .min(10, { message: 'Please provide a detailed description (at least 10 characters)' }),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

export function TicketForm() {
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (values: TicketFormValues) => {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/tickets`,
        values
      );
      return response.data;
    },
    onSuccess: (data) => {
      setSuccessMessage(`Ticket #${data.id?.slice(0, 8) || 'new'} created successfully!`);
      reset();
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      console.error('Error creating ticket:', err);
    },
  });

  const onSubmit = (data: TicketFormValues) => {
    createTicketMutation.mutate(data);
  };

  return (
    <Card className="w-full max-w-xl mx-auto shadow-md">
      <CardHeader>
        <CardTitle>Submit Support Ticket</CardTitle>
        <CardDescription>
          Fill in details below. Our support engineering team will respond shortly.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {successMessage && (
            <div className="p-3 text-sm rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800">
              {successMessage}
            </div>
          )}

          {createTicketMutation.isError && (
            <div className="p-3 text-sm rounded-md bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
              Failed to submit ticket. Ensure the backend API is running on port 3001.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="title">Ticket Subject / Title</Label>
            <Input
              id="title"
              placeholder="e.g. Inability to generate billing invoice report"
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-red-500 font-medium">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="priority">Priority Level</Label>
            <select
              id="priority"
              {...register('priority')}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 dark:border-slate-800 dark:focus-visible:ring-slate-300"
            >
              <option value="LOW">Low - General query or enhancement</option>
              <option value="MEDIUM">Medium - Normal operational issue</option>
              <option value="HIGH">High - Major feature degraded</option>
              <option value="URGENT">Urgent - System wide outage or blocker</option>
            </select>
            {errors.priority && (
              <p className="text-xs text-red-500 font-medium">{errors.priority.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Issue Description</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Provide step-by-step reproduction details, expected results, and actual behavior..."
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-red-500 font-medium">{errors.description.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => reset()}
            disabled={createTicketMutation.isPending}
          >
            Clear
          </Button>
          <Button type="submit" disabled={createTicketMutation.isPending}>
            {createTicketMutation.isPending ? 'Submitting...' : 'Submit Ticket'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
