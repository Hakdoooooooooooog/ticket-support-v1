'use client';

import { Button } from '@ui/button';
import { formatByteSize, DecryptedAttachmentResult } from '@lib/helpers';

export interface TicketAttachmentPreviewProps {
  attachmentName?: string | null;
  attachmentOriginalSize?: number | null;
  decryptedImage?: DecryptedAttachmentResult | null;
  isLoading?: boolean;
  isHidden?: boolean;
  onToggleVisibility?: () => void;
  onClickPreview?: (payload: DecryptedAttachmentResult) => void;
  className?: string;
}

export function TicketAttachmentPreview({
  attachmentName,
  attachmentOriginalSize,
  decryptedImage,
  isLoading,
  isHidden,
  onToggleVisibility,
  onClickPreview,
  className = '',
}: TicketAttachmentPreviewProps) {
  return (
    <div className={`pt-2 border-t border-spruce-200/70 dark:border-spruce-800 space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-spruce-800 dark:text-spruce-200">
            {attachmentName || 'attachment.webp'}
          </span>
          {attachmentOriginalSize && (
            <span className="text-spruce-500 dark:text-spruce-400">
              ({formatByteSize(attachmentOriginalSize)})
            </span>
          )}
        </div>
        {decryptedImage ? (
          onToggleVisibility && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleVisibility}
              className="h-7 text-xs"
            >
              {isHidden ? 'Show Image' : 'Hide Image'}
            </Button>
          )
        ) : (
          <span className="text-[11px] text-spruce-400">
            {isLoading ? 'Decrypting attachment...' : ''}
          </span>
        )}
      </div>

      {decryptedImage && !isHidden && (
        <div className="pt-1">
          <img
            src={decryptedImage.dataUrl}
            alt={decryptedImage.fileName}
            onClick={() => onClickPreview?.(decryptedImage)}
            title="Click to inspect full-size image"
            className="max-h-64 rounded-md border border-spruce-200 dark:border-spruce-700 object-contain cursor-zoom-in hover:opacity-95 transition-opacity"
          />
        </div>
      )}
    </div>
  );
}
