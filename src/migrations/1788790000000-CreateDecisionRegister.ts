import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateDecisionRegister1788790000000 implements MigrationInterface {
  name = 'CreateDecisionRegister1788790000000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE decisions (id int NOT NULL AUTO_INCREMENT, project_id int NOT NULL, organization_id varchar(36) NOT NULL, title varchar(255) NOT NULL, context longtext NOT NULL, owner_id bigint NOT NULL, created_by_id bigint NOT NULL, decision_date date NOT NULL, status enum ('proposed','accepted','rejected','superseded') NOT NULL DEFAULT 'proposed', supersedes_decision_id int NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX IDX_decisions_filter (organization_id,project_id,status,owner_id,decision_date), PRIMARY KEY(id), CONSTRAINT FK_decision_project FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE, CONSTRAINT FK_decision_org FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE, CONSTRAINT FK_decision_owner FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT FK_decision_creator FOREIGN KEY(created_by_id) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT FK_decision_supersedes FOREIGN KEY(supersedes_decision_id) REFERENCES decisions(id) ON DELETE RESTRICT) ENGINE=InnoDB`,
    );
    await q.query(
      `CREATE TABLE decision_links (id int NOT NULL AUTO_INCREMENT, decision_id int NOT NULL, link_type enum ('task','message','note','document','user') NOT NULL, link_id varchar(64) NOT NULL, snapshot_label varchar(255) NOT NULL, UNIQUE INDEX UQ_decision_link(decision_id,link_type,link_id), PRIMARY KEY(id), CONSTRAINT FK_decision_link FOREIGN KEY(decision_id) REFERENCES decisions(id) ON DELETE CASCADE) ENGINE=InnoDB`,
    );
    await q.query(
      `CREATE TABLE decision_history (id int NOT NULL AUTO_INCREMENT, decision_id int NOT NULL, actor_id bigint NOT NULL, action varchar(32) NOT NULL, snapshot json NOT NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX IDX_decision_history(decision_id,created_at), PRIMARY KEY(id), CONSTRAINT FK_decision_history_decision FOREIGN KEY(decision_id) REFERENCES decisions(id) ON DELETE CASCADE, CONSTRAINT FK_decision_history_actor FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE RESTRICT) ENGINE=InnoDB`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE decision_history');
    await q.query('DROP TABLE decision_links');
    await q.query('DROP TABLE decisions');
  }
}
