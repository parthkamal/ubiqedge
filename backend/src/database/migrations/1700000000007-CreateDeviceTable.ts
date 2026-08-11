import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeviceTable1700000000007 implements MigrationInterface {
  name = 'CreateDeviceTable1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`device\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`serialNo\` varchar(64) NOT NULL, \`deviceTypeId\` int NOT NULL, \`connectionId\` int NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`orgId\` varchar(32) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, UNIQUE INDEX \`IDX_a01479965173cac1e9f7d0d0ff\` (\`serialNo\`, \`orgId\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_e23ca0c7e22ffc2d8c6233c20d9\` FOREIGN KEY (\`deviceTypeId\`) REFERENCES \`device_type\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_50119c4bbc8aaa8b6f4d5e85c2f\` FOREIGN KEY (\`connectionId\`) REFERENCES \`customer_connection\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_10948aae53409e0dec1137b1ddd\` FOREIGN KEY (\`orgId\`) REFERENCES \`organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`device\``);
  }
}
