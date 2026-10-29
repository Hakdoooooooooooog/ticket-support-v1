import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { StorageService } from './storage.service.js';
import { PresignUploadDto, PresignUploadResponseDto, UploadFallbackDto } from './dto/presign-upload.dto.js';
import { randomUUID } from 'node:crypto';

@ApiTags('Storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets/attachments')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presign-upload')
  @ApiOperation({ summary: 'Generate a presigned S3/MinIO direct upload URL for encrypted attachments' })
  async presignUpload(@Body() dto: PresignUploadDto): Promise<PresignUploadResponseDto> {
    return this.storageService.generatePresignedUploadUrl(dto.fileName, dto.mimeType);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Fallback streaming API upload when direct browser-to-S3 upload is blocked' })
  async uploadFallback(
    @Body() payload: UploadFallbackDto,
  ) {
    if (!payload?.data || !payload?.fileName) {
      throw new BadRequestException('Missing fileName or data payload');
    }

    const mimeType = payload.mimeType || 'application/octet-stream';
    const buffer = Buffer.from(payload.data, 'base64');
    const sanitizedName = payload.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `attachments/${Date.now()}-${randomUUID()}-${sanitizedName}`;

    await this.storageService.uploadBuffer(storageKey, buffer, mimeType);

    return {
      storageKey,
      bucket: this.storageService.getBucketName(),
      fileSize: buffer.byteLength,
    };
  }

  @Get('presign-download')
  @ApiOperation({ summary: 'Generate a presigned S3/MinIO direct download URL for a storage key' })
  async presignDownload(@Query('key') key: string) {
    if (!key) {
      throw new BadRequestException('Storage key is required');
    }
    return this.storageService.generatePresignedDownloadUrl(key);
  }

  @Get('stream')
  @ApiOperation({ summary: 'Stream an encrypted attachment from S3 through the API proxy' })
  async streamAttachment(@Query('key') key: string, @Res() res: Response) {
    if (!key) {
      throw new BadRequestException('Storage key is required');
    }

    try {
      const { stream, contentType, contentLength } = await this.storageService.getObjectStream(key);
      res.setHeader('Content-Type', contentType);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength.toString());
      }
      res.setHeader('Cache-Control', 'private, max-age=3600');
      stream.pipe(res);
    } catch {
      throw new BadRequestException('Failed to retrieve file from storage');
    }
  }
}
