import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizationTable1700000000001 implements MigrationInterface {
  name = 'CreateOrganizationTable1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`organization\` (\`id\` varchar(32) NOT NULL, \`name\` varchar(255) NOT NULL, \`apiKeySecretHash\` varchar(64) NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`organization\``);
  }
}
