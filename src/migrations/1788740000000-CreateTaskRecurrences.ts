import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskRecurrences1788740000000 implements MigrationInterface {
  name = 'CreateTaskRecurrences1788740000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE task_recurrences (id int NOT NULL AUTO_INCREMENT, organization_id varchar(36) NOT NULL, project_id int NOT NULL, created_by_id bigint NOT NULL, template_task_id int NOT NULL, frequency enum('daily','weekly','monthly','weekdays') NOT NULL, \`interval\` int NOT NULL DEFAULT 1, weekdays json NULL, timezone varchar(64) NOT NULL, generation_mode enum('on_completion','before_due') NOT NULL, generate_before_days int NOT NULL DEFAULT 0, next_due_at datetime NOT NULL, next_generation_at datetime NULL, end_at datetime NULL, active tinyint NOT NULL DEFAULT 1, last_generated_at datetime NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX IDX_task_recurrences_scan (organization_id, active, next_generation_at), PRIMARY KEY (id), CONSTRAINT FK_task_recurrences_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE, CONSTRAINT FK_task_recurrences_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE, CONSTRAINT FK_task_recurrences_user FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT FK_task_recurrences_template FOREIGN KEY (template_task_id) REFERENCES tasks(id) ON DELETE CASCADE) ENGINE=InnoDB`,
    );
    await q.query(
      `CREATE TABLE task_recurrence_occurrences (id int NOT NULL AUTO_INCREMENT, recurrence_id int NOT NULL, task_id int NOT NULL, scheduled_due_at datetime NOT NULL, previous_task_id int NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX IDX_recurrence_due_unique (recurrence_id, scheduled_due_at), PRIMARY KEY (id), CONSTRAINT FK_occurrence_recurrence FOREIGN KEY (recurrence_id) REFERENCES task_recurrences(id) ON DELETE CASCADE, CONSTRAINT FK_occurrence_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE, CONSTRAINT FK_occurrence_previous FOREIGN KEY (previous_task_id) REFERENCES tasks(id) ON DELETE SET NULL) ENGINE=InnoDB`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS task_recurrence_occurrences');
    await q.query('DROP TABLE IF EXISTS task_recurrences');
  }
}
