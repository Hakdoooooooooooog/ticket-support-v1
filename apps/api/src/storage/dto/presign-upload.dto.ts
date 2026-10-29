import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const presignUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255).describe('Name of the file to upload'),
  mimeType: z.string().trim().min(1).max(100).default('application/octet-stream').describe('MIME type of file'),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024).optional().describe('File size in bytes (max 50MB)'),
});

export class PresignUploadDto extends createZodDto(presignUploadSchema) {}

export const presignUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  storageKey: z.string(),
  bucket: z.string(),
  expiresIn: z.number().default(900),
});

export class PresignUploadResponseDto extends createZodDto(presignUploadResponseSchema) {}

export const uploadFallbackSchema = z.object({
  fileName: z.string().trim().min(1).max(255).describe('Name of the file to upload'),
  mimeType: z.string().trim().min(1).max(100).optional().describe('MIME type of file'),
  data: z.string().min(1).describe('Base64-encoded attachment payload'),
});

export class UploadFallbackDto extends createZodDto(uploadFallbackSchema) {}
