import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerInvoiceTable1700000000011 implements MigrationInterface {
  name = 'CreateCustomerInvoiceTable1700000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`customer_invoice\` (\`id\` int NOT NULL AUTO_INCREMENT, \`serialNo\` varchar(64) NOT NULL, \`deviceId\` int NOT NULL, \`billingPeriodStart\` date NOT NULL, \`billingPeriodEnd\` date NOT NULL, \`openingCheckpointId\` bigint NOT NULL, \`closingCheckpointId\` bigint NOT NULL, \`openingReading\` decimal(18,4) NOT NULL, \`closingReading\` decimal(18,4) NOT NULL, \`consumptionUnits\` decimal(18,4) NOT NULL, \`pricingConfigId\` int NOT NULL, \`appliedUnitRate\` decimal(12,4) NOT NULL, \`amount\` decimal(12,2) NOT NULL, \`status\` enum ('PENDING', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING', \`transactionId\` varchar(255) NULL, \`transactionProvider\` varchar(64) NULL, \`generatedAt\` datetime NOT NULL, \`dueDate\` date NULL, \`orgId\` varchar(32) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_792abc5522e6bb95e61f4a3c3d\` (\`deviceId\`, \`billingPeriodStart\`, \`billingPeriodEnd\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_f5e9917e5c0ad4c036a35c486fa\` FOREIGN KEY (\`deviceId\`) REFERENCES \`device\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_3e75640f42fc9595666442d8625\` FOREIGN KEY (\`openingCheckpointId\`) REFERENCES \`device_telemetry\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_bfd12e3c78e75f4f993a9177c9f\` FOREIGN KEY (\`closingCheckpointId\`) REFERENCES \`device_telemetry\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_4cbddb395d188c34be381f07fff\` FOREIGN KEY (\`pricingConfigId\`) REFERENCES \`pricing_config\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_501f6cccec5081876d48808a6fb\` FOREIGN KEY (\`orgId\`) REFERENCES \`organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`customer_invoice\``);
  }
}
