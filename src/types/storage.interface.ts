import { MulterFile } from '../types/multer.types';

export interface StorageService {
  uploadFile(file: MulterFile, path: string): Promise<string>;
  deleteFile(filePath: string): Promise<void>;
  getSignedUrl(filePath: string, expiresIn?: number): Promise<string>;
  downloadFile(filePath: string): Promise<Buffer>;
  listFiles(path: string): Promise<any[]>;
  moveFile(fromPath: string, toPath: string): Promise<void>;
  generateFilePath(
    projectId: number,
    taskId: number | null,
    filename: string,
  ): string;
  getFileMetadata(filePath: string): Promise<any>;
}
