import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private isConfigured = false;

  constructor(private readonly config: ConfigService) {
    this.bucketName =
      this.config.get<string>('S3_BUCKET_NAME') ||
      process.env.S3_BUCKET_NAME ||
      'ticketsupport-attachments';
  }

  async onModuleInit() {
    await this.initS3Client();
  }

  private async initS3Client() {
    const endpoint =
      this.config.get<string>('S3_ENDPOINT') || process.env.S3_ENDPOINT || 'http://localhost:9000';
    const region =
      this.config.get<string>('S3_REGION') || process.env.S3_REGION || 'ap-southeast-1';
    const accessKeyId =
      this.config.get<string>('S3_ACCESS_KEY') || process.env.S3_ACCESS_KEY || 'minioadmin';
    const secretAccessKey =
      this.config.get<string>('S3_SECRET_KEY') || process.env.S3_SECRET_KEY || 'minioadmin';
    const forcePathStyle =
      (this.config.get<string>('S3_FORCE_PATH_STYLE') || process.env.S3_FORCE_PATH_STYLE) !== 'false';

    try {
      this.s3Client = new S3Client({
        region,
        endpoint: endpoint || undefined,
        forcePathStyle,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      // Ensure bucket exists and has CORS for direct web browser uploads
      await this.ensureBucket();
      await this.configureCors();
      this.isConfigured = true;
      this.logger.log(`S3 Storage configured successfully: bucket="${this.bucketName}" region="${region}" endpoint="${endpoint}"`);
    } catch (err: any) {
      this.logger.warn(`Failed to connect to S3 storage on initialization (${err.message}). Will retry on demand.`);
      this.isConfigured = false;
    }
  }

  private async ensureBucket(): Promise<void> {
    if (!this.s3Client) return;
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
    } catch (err: any) {
      // 404 or NotFound -> bucket does not exist, create it
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        this.logger.log(`Bucket "${this.bucketName}" not found. Creating it...`);
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
        this.logger.log(`Bucket "${this.bucketName}" created.`);
      } else {
        throw err;
      }
    }
  }

  private async configureCors(): Promise<void> {
    if (!this.s3Client) return;
    try {
      await this.s3Client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucketName,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'HEAD', 'POST', 'DELETE'],
                AllowedOrigins: ['*'],
                ExposeHeaders: ['ETag'],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
      this.logger.log(`CORS configured for bucket "${this.bucketName}".`);
    } catch (err: any) {
      this.logger.warn(`Could not set CORS on bucket "${this.bucketName}": ${err.message}`);
    }
  }

  getBucketName(): string {
    return this.bucketName;
  }

  isReady(): boolean {
    return this.isConfigured && this.s3Client !== null;
  }

  async generatePresignedUploadUrl(
    fileName: string,
    mimeType = 'application/octet-stream',
    prefix = 'attachments',
    expiresIn = 900,
  ): Promise<{ uploadUrl: string; storageKey: string; bucket: string; expiresIn: number }> {
    if (!this.s3Client) {
      await this.initS3Client();
    }
    if (!this.s3Client) {
      throw new Error('S3 client is not available');
    }

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `${prefix}/${Date.now()}-${randomUUID()}-${sanitizedName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      uploadUrl,
      storageKey,
      bucket: this.bucketName,
      expiresIn,
    };
  }

  async generatePresignedDownloadUrl(
    storageKey: string,
    expiresIn = 900,
  ): Promise<{ downloadUrl: string; expiresIn: number }> {
    if (!this.s3Client) {
      await this.initS3Client();
    }
    if (!this.s3Client) {
      throw new Error('S3 client is not available');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      downloadUrl,
      expiresIn,
    };
  }

  async uploadBuffer(
    storageKey: string,
    buffer: Buffer,
    mimeType = 'application/octet-stream',
  ): Promise<{ storageKey: string; bucket: string }> {
    if (!this.s3Client) {
      await this.initS3Client();
    }
    if (!this.s3Client) {
      throw new Error('S3 client is not available');
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    return {
      storageKey,
      bucket: this.bucketName,
    };
  }

  async getObjectStream(
    storageKey: string,
  ): Promise<{ stream: Readable; contentType: string; contentLength?: number }> {
    if (!this.s3Client) {
      await this.initS3Client();
    }
    if (!this.s3Client) {
      throw new Error('S3 client is not available');
    }

    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      }),
    );

    return {
      stream: response.Body as Readable,
      contentType: response.ContentType || 'application/octet-stream',
      contentLength: response.ContentLength,
    };
  }
}
