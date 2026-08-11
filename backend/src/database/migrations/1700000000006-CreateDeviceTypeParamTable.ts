import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeviceTypeParamTable1700000000006 implements MigrationInterface {
  name = 'CreateDeviceTypeParamTable1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`device_type_param\` (\`id\` int NOT NULL AUTO_INCREMENT, \`deviceTypeId\` int NOT NULL, \`paramKey\` enum ('LEVEL', 'TOTAL', 'FLOW') NOT NULL, \`displayName\` varchar(255) NOT NULL, \`dataType\` enum ('numeric') NOT NULL DEFAULT 'numeric', \`orgId\` varchar(32) NOT NULL, UNIQUE INDEX \`IDX_62777eaf7ea7826bcf298c0a9a\` (\`paramKey\`, \`orgId\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_30c62836b511dc0bdd04accee7b\` FOREIGN KEY (\`deviceTypeId\`) REFERENCES \`device_type\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_07377366da6bf8d527128dfed80\` FOREIGN KEY (\`orgId\`) REFERENCES \`organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`device_type_param\``);
  }
}
