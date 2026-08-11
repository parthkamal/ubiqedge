import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePricingSlabTable1700000000010 implements MigrationInterface {
  name = 'CreatePricingSlabTable1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`pricing_slab\` (\`id\` int NOT NULL AUTO_INCREMENT, \`pricingConfigId\` int NOT NULL, \`slabFrom\` decimal(12,4) NOT NULL, \`slabTo\` decimal(12,4) NULL, \`rate\` decimal(12,4) NOT NULL, UNIQUE INDEX \`IDX_211af62bdcea72571c0c7d02e0\` (\`pricingConfigId\`, \`slabFrom\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_8cfe11e310c73aad0adb8283fa5\` FOREIGN KEY (\`pricingConfigId\`) REFERENCES \`pricing_config\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`pricing_slab\``);
  }
}
