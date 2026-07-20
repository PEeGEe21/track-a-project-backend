import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataLifecycleEvent } from 'src/typeorm/entities/DataLifecycleEvent';
import { DataLifecycleService } from './data-lifecycle.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DataLifecycleEvent])],
  providers: [DataLifecycleService],
  exports: [DataLifecycleService],
})
export class DataLifecycleModule {}
