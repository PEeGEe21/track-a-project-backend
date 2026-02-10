import { ConfigService } from '@nestjs/config';
import { SupabaseStorageService } from './supabase-storage.service';

export const StorageProvider = {
  provide: 'STORAGE_SERVICE',
  useFactory: (
    config: ConfigService,
    supabase: SupabaseStorageService,
  ) => {
    return config.get('STORAGE_DRIVER') === 'minio' ? supabase : supabase;
  },
  inject: [ConfigService, SupabaseStorageService],
};
