import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from 'node:zlib';
import { BadRequestException } from '@nestjs/common';

export interface EncryptedAttachmentInput {
  ciphertext: string;
  iv: string;
  fileName: string;
  mimeType: string;
  originalSize?: number;
}

export interface CompressedAttachmentRecord {
  attachmentName: string;
  attachmentMimeType: string;
  attachmentCompressed: string;
  attachmentOriginalSize: number;
  attachmentCompressedSize: number;
}

export interface OnDemandAttachmentResponse {
  ticketId: string;
  fileName: string;
  mimeType: string;
  originalSize: number;
  storageType?: 'BASE64' | 'S3';
  downloadUrl?: string;
  storageKey?: string;
  encrypted?: {
    ciphertext: string;
    iv: string;
  };
}

function deriveAes256Key(): Buffer {
  const secret = process.env.NEXT_PUBLIC_ATTACHMENT_KEY?.trim();
  if (!secret) {
    throw new Error('Missing attachment key configuration');
  }
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function decryptAndCompressAttachment(
  input: EncryptedAttachmentInput,
): CompressedAttachmentRecord {
  try {
    const key = deriveAes256Key();
    const iv = Buffer.from(input.iv, 'base64');
    const combined = Buffer.from(input.ciphertext, 'base64');

    if (iv.byteLength !== 12 || combined.byteLength <= 16) {
      throw new Error('Invalid attachment payload');
    }

    const authTag = combined.subarray(combined.byteLength - 16);
    const encryptedData = combined.subarray(0, combined.byteLength - 16);

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    const compressedBuffer = brotliCompressSync(decryptedBuffer, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
      },
    });

    return {
      attachmentName: input.fileName.trim() || 'attachment.webp',
      attachmentMimeType: input.mimeType.trim() || 'image/webp',
      attachmentCompressed: compressedBuffer.toString('base64'),
      attachmentOriginalSize: input.originalSize || decryptedBuffer.byteLength,
      attachmentCompressedSize: compressedBuffer.byteLength,
    };
  } catch {
    throw new BadRequestException('Unable to process attachment');
  }
}

export function decompressAndEncryptAttachment(
  compressedBase64: string,
): { ciphertext: string; iv: string; decompressedSize: number } {
  const compressedBuffer = Buffer.from(compressedBase64, 'base64');
  const decompressedBuffer = brotliDecompressSync(compressedBuffer);

  const key = deriveAes256Key();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(decompressedBuffer),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    ciphertext: combined.toString('base64'),
    iv: iv.toString('base64'),
    decompressedSize: decompressedBuffer.byteLength,
  };
}
