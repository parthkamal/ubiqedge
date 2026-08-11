import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoleTable1700000000002 implements MigrationInterface {
  name = 'CreateRoleTable1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`role\` (\`id\` int NOT NULL AUTO_INCREMENT, \`type\` enum ('Admin', 'Customer') NOT NULL, \`displayName\` varchar(255) NOT NULL, \`orgId\` varchar(32) NOT NULL, UNIQUE INDEX \`IDX_cf0bb940ca0c82880b5106ada3\` (\`type\`, \`orgId\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_99d99cd64bae720888dd74f607a\` FOREIGN KEY (\`orgId\`) REFERENCES \`organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`role\``);
  }
}
