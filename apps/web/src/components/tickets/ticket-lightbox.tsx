'use client';

import { Button } from '@ui/button';
import { formatByteSize, DecryptedAttachmentResult } from '@lib/helpers';

export interface TicketLightboxProps {
  image: DecryptedAttachmentResult | null;
  onClose: () => void;
}

export function TicketLightbox({ image, onClose }: TicketLightboxProps) {
  if (!image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-spruce-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-5xl w-full bg-white dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800 rounded-xl p-4 space-y-3 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 text-xs text-spruce-800 dark:text-spruce-200">
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold truncate">{image.fileName}</span>
            <span className="text-spruce-500 dark:text-spruce-400">
              ({formatByteSize(image.originalSize)})
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-7 text-xs"
          >
            Close Preview
          </Button>
        </div>
        <div className="flex items-center justify-center max-h-[80vh] overflow-auto bg-spruce-100/50 dark:bg-spruce-950 rounded-lg p-2">
          <img
            src={image.dataUrl}
            alt={image.fileName}
            className="max-h-[76vh] w-auto object-contain rounded"
          />
        </div>
      </div>
    </div>
  );
}
