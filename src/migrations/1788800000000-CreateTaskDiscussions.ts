import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateTaskDiscussions1788800000000 implements MigrationInterface {
  name = 'CreateTaskDiscussions1788800000000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE task_comments (id varchar(36) NOT NULL, task_id int NOT NULL, organization_id varchar(36) NOT NULL, author_id bigint NOT NULL, parent_id varchar(36) NULL, root_id varchar(36) NULL, content text NOT NULL, mentions json NULL, is_resolved tinyint NOT NULL DEFAULT 0, resolved_by_id bigint NULL, resolved_at datetime NULL, edited_at datetime NULL, deleted_at datetime NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX IDX_task_comments_roots(task_id,parent_id,created_at), INDEX IDX_task_comments_thread(root_id,created_at), PRIMARY KEY(id), CONSTRAINT FK_tc_task FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE, CONSTRAINT FK_tc_org FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE, CONSTRAINT FK_tc_author FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT FK_tc_parent FOREIGN KEY(parent_id) REFERENCES task_comments(id) ON DELETE SET NULL) ENGINE=InnoDB`,
    );
    await q.query(
      `CREATE TABLE task_comment_reactions (id int NOT NULL AUTO_INCREMENT, comment_id varchar(36) NOT NULL, user_id bigint NOT NULL, emoji varchar(32) NOT NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX UQ_tc_reaction(comment_id,user_id,emoji), PRIMARY KEY(id), CONSTRAINT FK_tcr_comment FOREIGN KEY(comment_id) REFERENCES task_comments(id) ON DELETE CASCADE, CONSTRAINT FK_tcr_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB`,
    );
    await q.query(
      `CREATE TABLE task_comment_edits (id int NOT NULL AUTO_INCREMENT, comment_id varchar(36) NOT NULL, editor_id bigint NOT NULL, previous_content text NOT NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX IDX_tce_comment(comment_id,created_at), PRIMARY KEY(id), CONSTRAINT FK_tce_comment FOREIGN KEY(comment_id) REFERENCES task_comments(id) ON DELETE CASCADE, CONSTRAINT FK_tce_user FOREIGN KEY(editor_id) REFERENCES users(id) ON DELETE RESTRICT) ENGINE=InnoDB`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE task_comment_edits');
    await q.query('DROP TABLE task_comment_reactions');
    await q.query('DROP TABLE task_comments');
  }
}
