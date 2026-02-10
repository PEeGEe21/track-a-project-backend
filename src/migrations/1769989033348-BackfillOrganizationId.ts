import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class BackfillOrganizationId1769989033348 implements MigrationInterface {
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // USERS → USER_ORGS
    await queryRunner.query(`
      INSERT IGNORE INTO user_organizations (id, user_id, organization_id, role)
      SELECT UUID(), u.id, o.id, 'member'
      FROM users u
      CROSS JOIN organizations o
      WHERE o.slug = 'default-org'
    `);

    // PROJECTS
    await queryRunner.query(`
      UPDATE projects p
      JOIN user_organizations uo ON uo.user_id = p.user_id
      SET p.organization_id = uo.organization_id
    `);

    // TASKS
    await queryRunner.query(`
      UPDATE tasks t
      JOIN projects p ON p.id = t.project_id
      SET t.organization_id = p.organization_id
    `);

    // NOTES
    await queryRunner.query(`
      UPDATE notes n
      JOIN user_organizations uo ON uo.user_id = n.user_id
      SET n.organization_id = uo.organization_id
    `);

    // WHITEBOARDS
    await queryRunner.query(`
      UPDATE whiteboards w
      JOIN user_organizations uo ON uo.user_id = w.user_id
      SET w.organization_id = uo.organization_id
    `);

    // DOCUMENTS
    await queryRunner.query(`
      UPDATE documents d
      JOIN user_organizations uo ON uo.user_id = d.userId
      SET d.organization_id = uo.organization_id
    `);

    // RESOURCES
    await queryRunner.query(`
      UPDATE resources r
      JOIN projects p ON p.id = r.project_id
      SET r.organization_id = p.organization_id
    `);

    // COMMENTS / ACTIVITIES
    await queryRunner.query(`
      UPDATE project_comments pc
      JOIN projects p ON p.id = pc.project_id
      SET pc.organization_id = p.organization_id
    `);

    await queryRunner.query(`
      UPDATE project_activities pa
      JOIN projects p ON p.id = pa.projectId
      SET pa.organization_id = p.organization_id
    `);

    // CONVERSATIONS
    await queryRunner.query(`
      UPDATE conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id
      SET c.organization_id = cp.organization_id
    `);

    // MESSAGES
    await queryRunner.query(`
      UPDATE messages m
      JOIN conversations c ON c.id = m.conversation_id
      SET m.organization_id = c.organization_id
    `);

    // FINAL SAFETY CHECK
    const tables = await queryRunner.query(`
      SELECT TABLE_NAME t
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND COLUMN_NAME = 'organization_id'
    `);

    for (const { t } of tables) {
      const [r] = await queryRunner.query(`
        SELECT COUNT(*) c FROM ${t} WHERE organization_id IS NULL
      `);

      if (r.c > 0) {
        throw new Error(`❌ ${t} still has NULL organization_id`);
      }

      // enforce NOT NULL
      await queryRunner.changeColumn(t, 'organization_id', new TableColumn({
        name: 'organization_id',
        type: 'varchar',
        length: '36',
        isNullable: false,
      }));

      // FK
      await queryRunner.createForeignKey(t, new TableForeignKey({
        name: `FK_${t}_organization`,
        columnNames: ['organization_id'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }));
    }
  }

  public async down(): Promise<void> {
    // no rollback on legacy data
  }
}
