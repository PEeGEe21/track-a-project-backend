import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { MulterFile } from '../types/multer.types';

@Injectable()
export class SupabaseStorageService {
  private supabase: SupabaseClient;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');
    const bucketName = this.configService.get<string>('SUPABASE_BUCKET_NAME');
    
    this.bucketName = bucketName;

    if (!supabaseUrl || !supabaseKey || !bucketName) {
      throw new Error('Supabase URL and Key and BucketName must be provided');
    }

    // console.log('Supabase Config:', {
    //   url: supabaseUrl,
    //   bucket: this.bucketName,
    //   keyPresent: !!supabaseKey
    // });

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initializeBucket();
  }

  /**
   * Initialize bucket if it doesn't exist
   */
  private async initializeBucket(){
    try {
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === this.bucketName);

      if (!bucketExists) {
        await this.supabase.storage.createBucket(this.bucketName, {
          public: false, // Set to true if you want public access
          fileSizeLimit: 52428800, // 50MB limit
          allowedMimeTypes: [
            'image/*',
            'video/*',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/*',
          ],
        });
        console.log(`Bucket '${this.bucketName}' created successfully`);
      }
    } catch (error) {
      console.error('Error initializing bucket:', error.message);
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(file: MulterFile, path: string): Promise<string> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(path, file.buffer, {
          contentType: file.mimetype,
          upsert: false, // Set to true if you want to overwrite existing files
        });

      if (error) {
        throw new HttpException(
          `Failed to upload file: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(path);

      return urlData.publicUrl;
    } catch (error) {
      throw new HttpException(
        `Failed to upload file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete file from Supabase Storage
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        throw new HttpException(
          `Failed to delete file: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      console.log(`File deleted successfully: ${filePath}`);
    } catch (error) {
      throw new HttpException(
        `Failed to delete file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get signed URL for private files (expires in 1 hour by default)
   */
  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        throw new HttpException(
          `Failed to generate signed URL: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return data.signedUrl;
    } catch (error) {
      throw new HttpException(
        `Failed to generate signed URL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Download file from Supabase Storage
   */
  async downloadFile(filePath: string): Promise<Blob> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(filePath);

      if (error) {
        console.log(error, 'error')
        throw new HttpException(
          `Failed to download file: ${error.message}`,
          HttpStatus.NOT_FOUND,
        );
      }

      console.log(data, 'data')


      return data;
    } catch (error) {
      throw new HttpException(
        `Failed to download file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(path: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(path);

      if (error) {
        throw new HttpException(
          `Failed to list files: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return data;
    } catch (error) {
      throw new HttpException(
        `Failed to list files: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Move/Rename file
   */
  async moveFile(fromPath: string, toPath: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .move(fromPath, toPath);

      if (error) {
        throw new HttpException(
          `Failed to move file: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      console.log(`File moved from ${fromPath} to ${toPath}`);
    } catch (error) {
      throw new HttpException(
        `Failed to move file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generate file path with timestamp and sanitization
   */
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

  /**
   * Get file metadata
   */
  async getFileMetadata(filePath: string): Promise<any> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(filePath.split('/').slice(0, -1).join('/'), {
          search: filePath.split('/').pop(),
        });

      if (error || !data || data.length === 0) {
        throw new HttpException(
          'File not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return data[0];
    } catch (error) {
      throw new HttpException(
        `Failed to get file metadata: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}