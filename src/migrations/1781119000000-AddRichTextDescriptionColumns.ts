import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRichTextDescriptionColumns1781119000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE projects
      ADD COLUMN description_html LONGTEXT NULL AFTER description
    `);

    await queryRunner.query(`
      ALTER TABLE tasks
      ADD COLUMN description_html LONGTEXT NULL AFTER description
    `);

    await queryRunner.query(`
      UPDATE projects
      SET description_html = CASE
        WHEN description IS NULL OR TRIM(description) = '' THEN NULL
        ELSE CONCAT(
          '<p>',
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(description, '&', '&amp;'),
                  '<',
                  '&lt;'
                ),
                '>',
                '&gt;'
              ),
              CHAR(13),
              ''
            ),
            CHAR(10),
            '<br />'
          ),
          '</p>'
        )
      END
      WHERE description_html IS NULL
    `);

    await queryRunner.query(`
      UPDATE tasks
      SET description_html = CASE
        WHEN description IS NULL OR TRIM(description) = '' THEN NULL
        ELSE CONCAT(
          '<p>',
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(description, '&', '&amp;'),
                  '<',
                  '&lt;'
                ),
                '>',
                '&gt;'
              ),
              CHAR(13),
              ''
            ),
            CHAR(10),
            '<br />'
          ),
          '</p>'
        )
      END
      WHERE description_html IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks
      DROP COLUMN description_html
    `);

    await queryRunner.query(`
      ALTER TABLE projects
      DROP COLUMN description_html
    `);
  }
}
