import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from '../../../src/storage/storage.service.js';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-s3.amazonaws.com/presigned-url?signature=xyz'),
}));

vi.mock('@aws-sdk/client-s3', () => {
  class MockS3Client {
    async send(command: any) {
      if (command?.constructor?.name === 'HeadBucketCommand') {
        return {};
      }
      if (command?.constructor?.name === 'GetObjectCommand') {
        return {
          Body: { pipe: vi.fn() },
          ContentType: 'image/png',
          ContentLength: 1024,
        };
      }
      return {};
    }
  }

  return {
    S3Client: MockS3Client,
    HeadBucketCommand: class HeadBucketCommand { constructor(public params: any) {} },
    CreateBucketCommand: class CreateBucketCommand { constructor(public params: any) {} },
    PutObjectCommand: class PutObjectCommand { constructor(public params: any) {} },
    GetObjectCommand: class GetObjectCommand { constructor(public params: any) {} },
    PutBucketCorsCommand: class PutBucketCorsCommand { constructor(public params: any) {} },
  };
});

describe('StorageService', () => {
  let service: StorageService;
  let config: any;

  beforeEach(async () => {
    config = {
      get: vi.fn((key: string) => {
        if (key === 'S3_BUCKET_NAME') return 'test-bucket';
        if (key === 'S3_REGION') return 'ap-southeast-1';
        if (key === 'S3_ENDPOINT') return 'http://localhost:9000';
        return null;
      }),
    };
    service = new StorageService(config);
    await service.onModuleInit();
  });

  it('should initialize bucket and return bucket name', () => {
    expect(service.getBucketName()).toBe('test-bucket');
    expect(service.isReady()).toBe(true);
  });

  it('should generate presigned upload URL with sanitized key', async () => {
    const result = await service.generatePresignedUploadUrl('my dangerous #file?.png', 'image/png');

    expect(result.uploadUrl).toContain('https://mock-s3.amazonaws.com');
    expect(result.bucket).toBe('test-bucket');
    expect(result.storageKey).toMatch(/^attachments\/\d+-[0-9a-f-]+-my_dangerous__file_\.png$/);
    expect(result.expiresIn).toBe(900);
  });

  it('should generate presigned download URL for an existing storage key', async () => {
    const result = await service.generatePresignedDownloadUrl('attachments/sample-key.webp');

    expect(result.downloadUrl).toContain('https://mock-s3.amazonaws.com');
    expect(result.expiresIn).toBe(900);
  });
});
