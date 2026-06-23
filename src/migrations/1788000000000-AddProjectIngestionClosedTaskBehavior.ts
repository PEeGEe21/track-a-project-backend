import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectIngestionClosedTaskBehavior1788000000000
  implements MigrationInterface
{
  name = 'AddProjectIngestionClosedTaskBehavior1788000000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {}

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
