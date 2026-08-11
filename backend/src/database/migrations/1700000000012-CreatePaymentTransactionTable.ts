import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentTransactionTable1700000000012 implements MigrationInterface {
  name = 'CreatePaymentTransactionTable1700000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`payment_transaction\` (\`id\` int NOT NULL AUTO_INCREMENT, \`invoiceId\` int NOT NULL, \`provider\` varchar(64) NOT NULL, \`providerTransactionId\` varchar(255) NOT NULL, \`amount\` decimal(12,2) NOT NULL, \`status\` enum ('INITIATED', 'SUCCESS', 'FAILED') NOT NULL, \`rawPayload\` json NULL, \`orgId\` varchar(32) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_1eccf12a3e900916cc6f42664f\` (\`provider\`, \`providerTransactionId\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_8fbffcf42dd2aed246ba60cee63\` FOREIGN KEY (\`invoiceId\`) REFERENCES \`customer_invoice\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_8862338a7d59dbc919c4b0e498b\` FOREIGN KEY (\`orgId\`) REFERENCES \`organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`payment_transaction\``);
  }
}
