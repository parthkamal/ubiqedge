import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePricingConfigTable1700000000009 implements MigrationInterface {
  name = 'CreatePricingConfigTable1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`pricing_config\` (\`id\` int NOT NULL AUTO_INCREMENT, \`deviceTypeId\` int NOT NULL, \`rateType\` enum ('FIXED', 'SLAB') NOT NULL, \`fixedRate\` decimal(12,4) NULL, \`effectiveFrom\` datetime NOT NULL, \`effectiveTo\` datetime NULL, \`orgId\` varchar(32) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_a984a53c88dc90f52a15436db2e\` FOREIGN KEY (\`deviceTypeId\`) REFERENCES \`device_type\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_bd4e3918c96bd699eee91df8653\` FOREIGN KEY (\`orgId\`) REFERENCES \`organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`pricing_config\``);
  }
}
