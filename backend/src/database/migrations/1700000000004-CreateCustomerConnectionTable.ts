import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerConnectionTable1700000000004 implements MigrationInterface {
  name = 'CreateCustomerConnectionTable1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`customer_connection\` (\`id\` int NOT NULL AUTO_INCREMENT, \`accountNo\` varchar(64) NOT NULL, \`userId\` int NOT NULL, \`status\` enum ('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE', \`orgId\` varchar(32) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, UNIQUE INDEX \`IDX_6aa0ddb27c0b774361fd0b1104\` (\`accountNo\`, \`orgId\`), UNIQUE INDEX \`REL_97206c2acbdfdb890c22efa463\` (\`userId\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_97206c2acbdfdb890c22efa463f\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_a2067ca567049eca580eb6ec2d1\` FOREIGN KEY (\`orgId\`) REFERENCES \`organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`customer_connection\``);
  }
}
