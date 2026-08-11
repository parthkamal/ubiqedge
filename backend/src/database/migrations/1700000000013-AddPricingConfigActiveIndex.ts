import { MigrationInterface, QueryRunner } from 'typeorm';

// covers PricingService.findActive and InvoiceService.generateForDevice's
// per-device active-config lookup (deviceTypeId + orgId + effectiveTo IS
// NULL) — see PricingConfig entity for why.
export class AddPricingConfigActiveIndex1700000000013 implements MigrationInterface {
  name = 'AddPricingConfigActiveIndex1700000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX \`IDX_fc8479edd2d1e3c90c9da3c947\` ON \`pricing_config\` (\`deviceTypeId\`, \`orgId\`, \`effectiveTo\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // dropping the composite index alone fails: InnoDB silently reassigned
    // the deviceTypeId FK constraint to it (as leftmost-column matcher),
    // replacing the plain single-column index CreateDeviceTypeTable's FK
    // originally auto-created. Recreate that support index by name first,
    // so the FK always has a valid backing index and revert is exact.
    await queryRunner.query(
      `CREATE INDEX \`FK_a984a53c88dc90f52a15436db2e\` ON \`pricing_config\` (\`deviceTypeId\`)`,
    );
    await queryRunner.query(`DROP INDEX \`IDX_fc8479edd2d1e3c90c9da3c947\` ON \`pricing_config\``);
  }
}
