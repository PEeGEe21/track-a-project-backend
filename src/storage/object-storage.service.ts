import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { MulterFile } from 'src/types/multer.types';
import { StorageService } from 'src/types/storage.interface';

@Injectable()
export class ObjectStorageService implements StorageService {
  private readonly client?: MinioClient;
  private readonly bucketName?: string;
  private readonly endpoint?: string;
  private readonly publicBaseUrl?: string;
  private readonly signedUrlTtlSeconds: number;
  private readonly enabled: boolean;
  private readonly publicReadEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<string>('STORAGE_DRIVER') === 'minio';

    const bucketName = this.configService.get<string>('S3_BUCKET_NAME');
    const accessKey = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('S3_ENDPOINT');

    this.signedUrlTtlSeconds = Number(
      this.configService.get<string>('S3_SIGNED_URL_TTL_SECONDS') || 3600,
    );
    this.publicReadEnabled =
      this.configService.get<string>('S3_BUCKET_PUBLIC_READ') !== 'false';

    if (!this.enabled) {
      return;
    }

    if (!bucketName || !accessKey || !secretKey || !endpoint) {
      throw new Error(
        'S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_ENDPOINT must be provided',
      );
    }

    const endpointUrl = new URL(endpoint);

    this.bucketName = bucketName;
    this.endpoint = endpoint.replace(/\/+$/, '');
    this.publicBaseUrl =
      this.configService
        .get<string>('S3_PUBLIC_BASE_URL')
        ?.replace(/\/+$/, '') || undefined;

    this.client = new MinioClient({
      endPoint: endpointUrl.hostname,
      port: endpointUrl.port ? Number(endpointUrl.port) : undefined,
      useSSL: endpointUrl.protocol === 'https:',
      accessKey,
      secretKey,
      pathStyle:
        this.configService.get<string>('S3_FORCE_PATH_STYLE') === 'true',
      region: this.configService.get<string>('S3_REGION') || 'us-east-1',
    });

    void this.ensureBucket();
  }

  async uploadFile(file: MulterFile, path: string): Promise<string> {
    try {
      this.assertEnabled();

      await this.client.putObject(this.bucketName, path, file.buffer, file.size, {
        'Content-Type': file.mimetype,
      });

      return this.buildObjectUrl(path);
    } catch (error: any) {
      throw new HttpException(
        `Failed to upload file: ${error?.message || 'Unknown storage error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      this.assertEnabled();
      await this.client.removeObject(
        this.bucketName,
        this.normalizeStorageKey(filePath),
      );
    } catch (error: any) {
      throw new HttpException(
        `Failed to delete file: ${error?.message || 'Unknown storage error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSignedUrl(
    filePath: string,
    expiresIn: number = this.signedUrlTtlSeconds,
  ): Promise<string> {
    try {
      this.assertEnabled();
      return await this.client.presignedGetObject(
        this.bucketName,
        this.normalizeStorageKey(filePath),
        expiresIn,
      );
    } catch (error: any) {
      throw new HttpException(
        `Failed to generate signed URL: ${error?.message || 'Unknown storage error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    try {
      this.assertEnabled();

      const stream = await this.client.getObject(
        this.bucketName,
        this.normalizeStorageKey(filePath),
      );

      const chunks: Buffer[] = [];
      for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (error: any) {
      throw new HttpException(
        `Failed to download file: ${error?.message || 'Unknown storage error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async listFiles(path: string): Promise<any[]> {
    try {
      this.assertEnabled();

      const stream = this.client.listObjectsV2(this.bucketName, path, true);

      return await new Promise<any[]>((resolve, reject) => {
        const objects: any[] = [];

        stream.on('data', (item) => objects.push(item));
        stream.on('error', (error) => reject(error));
        stream.on('end', () => resolve(objects));
      });
    } catch (error: any) {
      throw new HttpException(
        `Failed to list files: ${error?.message || 'Unknown storage error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async moveFile(fromPath: string, toPath: string): Promise<void> {
    const buffer = await this.downloadFile(fromPath);

    await this.uploadFile(
      {
        fieldname: 'file',
        originalname: toPath.split('/').pop() || 'file',
        encoding: '7bit',
        mimetype: 'application/octet-stream',
        size: buffer.length,
        buffer,
      },
      toPath,
    );

    await this.deleteFile(fromPath);
  }

  generateFilePath(
    projectId: number,
    taskId: number | null,
    filename: string,
  ): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');

    if (taskId) {
      return `projects/${projectId}/tasks/${taskId}/resources/${timestamp}_${sanitizedFilename}`;
    }

    return `projects/${projectId}/resources/${timestamp}_${sanitizedFilename}`;
  }

  async getFileMetadata(filePath: string): Promise<any> {
    try {
      this.assertEnabled();
      return await this.client.statObject(
        this.bucketName,
        this.normalizeStorageKey(filePath),
      );
    } catch (error: any) {
      throw new HttpException(
        `Failed to get file metadata: ${error?.message || 'Unknown storage error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private buildObjectUrl(key: string) {
    const normalizedKey = key.replace(/^\/+/, '');

    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${normalizedKey}`;
    }

    if (this.endpoint) {
      return `${this.endpoint}/${this.bucketName}/${normalizedKey}`;
    }

    return normalizedKey;
  }

  private normalizeStorageKey(filePath: string) {
    if (this.publicBaseUrl && filePath.startsWith(this.publicBaseUrl)) {
      return filePath.slice(this.publicBaseUrl.length + 1);
    }

    if (this.endpoint && this.bucketName) {
      const endpointPrefix = `${this.endpoint}/${this.bucketName}/`;
      if (filePath.startsWith(endpointPrefix)) {
        return filePath.slice(endpointPrefix.length);
      }
    }

    return filePath.replace(/^\/+/, '');
  }

  private async ensureBucket() {
    try {
      this.assertEnabled();

      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(
          this.bucketName,
          this.configService.get<string>('S3_REGION') || 'us-east-1',
        );
      }

      if (this.publicReadEnabled) {
        await this.client.setBucketPolicy(
          this.bucketName,
          JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { AWS: ['*'] },
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucketName}/*`],
              },
            ],
          }),
        );
      }
    } catch {
      // Bucket creation should not prevent boot; upload errors will surface later.
    }
  }

  private assertEnabled() {
    if (!this.enabled || !this.client || !this.bucketName) {
      throw new HttpException(
        'Object storage is not enabled for this environment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
