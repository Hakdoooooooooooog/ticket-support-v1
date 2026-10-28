'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@ui/card';
import { Input } from '@ui/input';
import { Textarea } from '@ui/textarea';
import { Label } from '@ui/label';
import { Badge } from '@ui/badge';
import { ContextualLoader } from '@ui/contextual-loader';
import { apiClient } from '@lib/api-client';
import {
  getStoredSession,
  formatShortTicketId,
  extractApiErrorMessage,
  compressAndEncryptImageFile,
  formatByteSize,
  EncryptedAttachmentPayload,
} from '@lib/helpers';
import { useAuthStore } from '@store/auth.store';
import { useTicketsStore } from '@store/tickets.store';

const ticketSchema = z.object({
  title: z
    .string()
    .min(5, { message: 'Title must be at least 5 characters long' })
    .max(100, { message: 'Title cannot exceed 100 characters' }),
  description: z
    .string()
    .min(10, { message: 'Please provide a detailed description (at least 10 characters)' }),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  department: z.enum(['TECHNICAL_SUPPORT', 'GENERAL']),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

export function TicketForm({ creatorId }: { creatorId?: string }) {
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [encryptedAttachment, setEncryptedAttachment] =
    React.useState<EncryptedAttachmentPayload | null>(null);
  const [isEncryptingImage, setIsEncryptingImage] = React.useState(false);
  const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { upsertTicket } = useTicketsStore();

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
      department: 'TECHNICAL_SUPPORT',
    },
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setAttachmentError(null);
    if (!file) {
      setEncryptedAttachment(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAttachmentError('Please select a valid image file (PNG, JPG, WebP, GIF).');
      return;
    }

    setIsEncryptingImage(true);
    try {
      const payload = await compressAndEncryptImageFile(file);
      setEncryptedAttachment(payload);
    } catch {
      setAttachmentError('Could not attach the selected image.');
      setEncryptedAttachment(null);
    } finally {
      setIsEncryptingImage(false);
    }
  };

  const clearAttachment = () => {
    setEncryptedAttachment(null);
    setAttachmentError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const createTicketMutation = useMutation({
    mutationFn: async (values: TicketFormValues) => {
      const session = getStoredSession();
      const activeCreatorId = creatorId || user?.id || session?.user?.id;
      const response = await apiClient.post('/tickets', {
        ...values,
        ...(activeCreatorId ? { creatorId: activeCreatorId } : {}),
        ...(encryptedAttachment ? { encryptedAttachment } : {}),
      });
      return response.data;
    },
    onSuccess: (data) => {
      upsertTicket(data);
      setSuccessMessage(`Ticket ${formatShortTicketId(data.id)} created successfully!`);
      reset();
      clearAttachment();
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setTimeout(() => setSuccessMessage(null), 5000);
    },
  });

  const onSubmit = (data: TicketFormValues) => {
    createTicketMutation.mutate(data);
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle>Submit Support Ticket</CardTitle>
        <CardDescription>
          Fill in details below. Our support engineering team will respond shortly.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {createTicketMutation.isPending && (
            <ContextualLoader context="ticket-submission" />
          )}

          {successMessage && (
            <div className="p-3 text-sm rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800">
              {successMessage}
            </div>
          )}

          {createTicketMutation.isError && (
            <div className="p-3 text-sm rounded-md bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
              {extractApiErrorMessage(
                createTicketMutation.error,
                'Unable to submit your ticket right now. Please try again shortly.',
              )}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="department">Support Department</Label>
              <select
                id="department"
                defaultValue="TECHNICAL_SUPPORT"
                {...register('department')}
                className="flex h-9 w-full rounded-md border border-spruce-300 bg-white dark:bg-spruce-900/80 px-3 py-1 text-sm text-spruce-950 dark:text-spruce-100 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-spruce-500 dark:border-spruce-700/80 dark:focus-visible:ring-spruce-300"
              >
                <option value="TECHNICAL_SUPPORT">Technical Support</option>
                <option value="GENERAL">General Inquiry</option>
              </select>
              {errors.department && (
                <p className="text-xs text-red-500 font-medium">{errors.department.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority Level</Label>
              <select
                id="priority"
                defaultValue="MEDIUM"
                {...register('priority')}
                className="flex h-9 w-full rounded-md border border-spruce-300 bg-white dark:bg-spruce-900/80 px-3 py-1 text-sm text-spruce-950 dark:text-spruce-100 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-spruce-500 dark:border-spruce-700/80 dark:focus-visible:ring-spruce-300"
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

          {/* Optional Image Attachment (Encrypted In-Transit + Brotli Compressed at Rest) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="attachment">Screenshot / Image Attachment (Optional)</Label>
            </div>
            <Input
              ref={fileInputRef}
              id="attachment"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="cursor-pointer text-xs file:mr-3 file:rounded file:border-0 file:bg-spruce-100 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-spruce-900 dark:file:bg-spruce-800 dark:file:text-spruce-200"
            />
            {isEncryptingImage && (
              <p className="text-xs text-spruce-600 dark:text-spruce-300 animate-pulse">
                Preparing attachment...
              </p>
            )}
            {attachmentError && (
              <p className="text-xs text-red-500 font-medium">{attachmentError}</p>
            )}
            {encryptedAttachment && !isEncryptingImage && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-spruce-100 dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-medium truncate text-spruce-950 dark:text-spruce-200">
                    {encryptedAttachment.fileName}
                  </span>
                  <span className="text-spruce-500 dark:text-spruce-400 shrink-0">
                    ({formatByteSize(encryptedAttachment.originalSize)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearAttachment}
                  className="text-red-500 hover:underline shrink-0 text-[11px]"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              clearAttachment();
            }}
            disabled={createTicketMutation.isPending || isEncryptingImage}
          >
            Clear
          </Button>
          <Button
            type="submit"
            disabled={createTicketMutation.isPending || isEncryptingImage}
          >
            {createTicketMutation.isPending ? 'Submitting...' : 'Submit Ticket'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
