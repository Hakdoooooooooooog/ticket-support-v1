'use client';

import * as React from 'react';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Textarea } from '@ui/textarea';
import {
  formatByteSize,
  formatShortTicketId,
  EncryptedAttachmentPayload,
} from '@lib/helpers';
import { Ticket } from './ticket-types';

export interface TicketAmendmentFormProps {
  ticket: Ticket;
  showFieldEdit: boolean;
  setShowFieldEdit: React.Dispatch<React.SetStateAction<boolean>>;
  amendTitle: string;
  setAmendTitle: (val: string) => void;
  amendDescription: string;
  setAmendDescription: (val: string) => void;
  amendPriority: Ticket['priority'];
  setAmendPriority: (val: Ticket['priority']) => void;
  amendNote: string;
  setAmendNote: (val: string) => void;
  amendAttachment: EncryptedAttachmentPayload | null;
  setAmendAttachment: (val: EncryptedAttachmentPayload | null) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  isPreparingImage: boolean;
  error?: string | null;
}

export function TicketAmendmentForm({
  ticket,
  showFieldEdit,
  setShowFieldEdit,
  amendTitle,
  setAmendTitle,
  amendDescription,
  setAmendDescription,
  amendPriority,
  setAmendPriority,
  amendNote,
  setAmendNote,
  amendAttachment,
  setAmendAttachment,
  onFileChange,
  onCancel,
  onSubmit,
  isSubmitting,
  isPreparingImage,
  error,
}: TicketAmendmentFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="p-3.5 rounded-lg border border-spruce-200 dark:border-spruce-700/80 bg-spruce-50/80 dark:bg-spruce-900/60 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-spruce-800 dark:text-spruce-200">
          {showFieldEdit
            ? `Amend Ticket ${formatShortTicketId(ticket.id)}`
            : `Follow-Up Reply on ${formatShortTicketId(ticket.id)}`}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowFieldEdit((v) => !v)}
            className="text-xs text-spruce-600 hover:text-spruce-800 dark:text-spruce-300 dark:hover:text-spruce-100 hover:underline font-medium cursor-pointer"
          >
            {showFieldEdit ? 'Hide Ticket Field Edits' : 'Edit Title / Priority / Description'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-spruce-400 hover:text-spruce-600 dark:hover:text-spruce-200 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      {showFieldEdit && (
        <div className="space-y-2.5 p-2.5 rounded-md bg-white/70 dark:bg-spruce-900/70 border border-spruce-200/70 dark:border-spruce-800">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Amended Title</Label>
              <Input
                value={amendTitle}
                onChange={(e) => setAmendTitle(e.target.value)}
                className="h-8 text-xs"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <select
                value={amendPriority}
                onChange={(e) => setAmendPriority(e.target.value as Ticket['priority'])}
                className="flex h-8 w-full rounded-md border border-spruce-300 bg-white px-2 text-xs text-spruce-900 dark:border-spruce-700 dark:bg-spruce-950 dark:text-spruce-100"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Amended Description</Label>
            <Textarea
              rows={3}
              value={amendDescription}
              onChange={(e) => setAmendDescription(e.target.value)}
              className="text-xs"
              required
            />
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Follow-Up Message / Clarification Note</Label>
        <Textarea
          rows={2}
          placeholder="Provide the requested details or explain what changed..."
          value={amendNote}
          onChange={(e) => setAmendNote(e.target.value)}
          className="text-xs"
          required={!showFieldEdit && !amendAttachment}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Attach Screenshot to This Message (Optional)</Label>
        <Input
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="h-8 text-xs cursor-pointer"
        />
        {amendAttachment && (
          <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 pt-0.5">
            <span>
              Attached to message: {amendAttachment.fileName} (
              {formatByteSize(amendAttachment.originalSize)})
            </span>
            <button
              type="button"
              onClick={() => setAmendAttachment(null)}
              className="text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 text-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || isPreparingImage}
          className="h-8 text-xs"
        >
          {isSubmitting ? 'Saving...' : 'Submit Follow-Up'}
        </Button>
      </div>
    </form>
  );
}
