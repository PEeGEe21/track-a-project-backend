import { ConfigService } from '@nestjs/config';
import { ObjectStorageService } from './object-storage.service';
import { SupabaseStorageService } from './supabase-storage.service';

export const StorageProvider = {
  provide: 'STORAGE_SERVICE',
  useFactory: (
    config: ConfigService,
    supabase: SupabaseStorageService,
    objectStorage: ObjectStorageService,
  ) => {
    return config.get('STORAGE_DRIVER') === 'minio'
      ? objectStorage
      : supabase;
  },
  inject: [ConfigService, SupabaseStorageService, ObjectStorageService],
};
