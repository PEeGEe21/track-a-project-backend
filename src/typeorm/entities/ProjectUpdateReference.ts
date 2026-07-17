import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProjectUpdate } from './ProjectUpdate';

export enum ProjectUpdateReferenceType { TASK = 'task', MILESTONE = 'milestone', DOCUMENT = 'document', USER = 'user' }

@Entity('project_update_references')
export class ProjectUpdateReference {
  @PrimaryGeneratedColumn() id: number;
  @Column() project_update_id: number;
  @ManyToOne(() => ProjectUpdate, (update) => update.references, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'project_update_id' }) update: ProjectUpdate;
  @Column({ type: 'enum', enum: ProjectUpdateReferenceType }) reference_type: ProjectUpdateReferenceType;
  @Column({ length: 64 }) reference_id: string;
  @Column({ length: 255 }) snapshot_label: string;
}
