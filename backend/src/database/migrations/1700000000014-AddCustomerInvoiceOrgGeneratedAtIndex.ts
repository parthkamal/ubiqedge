import { MigrationInterface, QueryRunner } from 'typeorm';

// covers InvoiceService.findAll/findMine — org-scoped, paginated,
// ORDER BY generatedAt DESC list screens — see CustomerInvoice entity.
export class AddCustomerInvoiceOrgGeneratedAtIndex1700000000014 implements MigrationInterface {
  name = 'AddCustomerInvoiceOrgGeneratedAtIndex1700000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX \`IDX_b3de1c8f47af9a264ecb38b324\` ON \`customer_invoice\` (\`orgId\`, \`generatedAt\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // dropping the composite index alone fails: InnoDB silently reassigned
    // the orgId FK constraint to it (as leftmost-column matcher), replacing
    // the plain single-column index CreateCustomerInvoiceTable's FK
    // originally auto-created. Recreate that support index by name first,
    // so the FK always has a valid backing index and revert is exact.
    await queryRunner.query(
      `CREATE INDEX \`FK_501f6cccec5081876d48808a6fb\` ON \`customer_invoice\` (\`orgId\`)`,
    );
    await queryRunner.query(`DROP INDEX \`IDX_b3de1c8f47af9a264ecb38b324\` ON \`customer_invoice\``);
  }
}
