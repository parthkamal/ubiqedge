import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeviceTelemetryTable1700000000008 implements MigrationInterface {
  name = 'CreateDeviceTelemetryTable1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`device_telemetry\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`deviceId\` int NOT NULL, \`deviceTypeId\` int NOT NULL, \`deviceTypeParamId\` int NOT NULL, \`value\` decimal(18,4) NOT NULL, \`serverTimestamp\` datetime NOT NULL, \`deviceTimestamp\` datetime NOT NULL, \`orgId\` varchar(32) NOT NULL, UNIQUE INDEX \`IDX_fa8e7f64ed3bc8d6efbb6e24e5\` (\`orgId\`, \`deviceId\`, \`deviceTypeParamId\`, \`deviceTimestamp\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_7a7774091ecb443cd58db34edb2\` FOREIGN KEY (\`deviceId\`) REFERENCES \`device\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_999a457631d31339244e3f8ca4e\` FOREIGN KEY (\`deviceTypeId\`) REFERENCES \`device_type\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_7f6d86c191e208530bca1662eed\` FOREIGN KEY (\`deviceTypeParamId\`) REFERENCES \`device_type_param\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_57165ce2a147acc7f4de200f06d\` FOREIGN KEY (\`orgId\`) REFERENCES \`organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`device_telemetry\``);
  }
}
