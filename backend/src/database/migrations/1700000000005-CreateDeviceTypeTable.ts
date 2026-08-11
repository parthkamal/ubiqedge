import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeviceTypeTable1700000000005 implements MigrationInterface {
  name = 'CreateDeviceTypeTable1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`device_type\` (\`id\` int NOT NULL AUTO_INCREMENT, \`type\` enum ('TANK', 'METER') NOT NULL, \`billed\` tinyint NOT NULL DEFAULT 0, \`orgId\` varchar(32) NOT NULL, UNIQUE INDEX \`IDX_ab91a0e45c8547d7acb972dabe\` (\`type\`, \`orgId\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_85aa667bd9c97e2d99028cc823b\` FOREIGN KEY (\`orgId\`) REFERENCES \`organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`device_type\``);
  }
}
