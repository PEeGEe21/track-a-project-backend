import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObjectStorageService } from './object-storage.service';
import { StorageProvider } from './storage.provider';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [SupabaseStorageService, ObjectStorageService, StorageProvider],
  exports: [
    SupabaseStorageService,
    ObjectStorageService,
    StorageProvider,
  ],
})
export class StorageModule {}
