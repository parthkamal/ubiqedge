import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTable1700000000003 implements MigrationInterface {
  name = 'CreateUserTable1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`user\` (\`id\` int NOT NULL AUTO_INCREMENT, \`firstName\` varchar(255) NOT NULL, \`lastName\` varchar(255) NULL, \`isActive\` tinyint NOT NULL DEFAULT 1, \`email\` varchar(255) NOT NULL, \`phoneNumber\` varchar(32) NOT NULL, \`passwordHash\` varchar(255) NOT NULL, \`address\` varchar(255) NOT NULL, \`pincode\` varchar(16) NOT NULL, \`orgId\` varchar(32) NOT NULL, \`roleId\` int NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, UNIQUE INDEX \`IDX_e12875dfb3b1d92d7d7c5377e2\` (\`email\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_4f5adb58513c2fe57eb9c79cc16\` FOREIGN KEY (\`orgId\`) REFERENCES \`organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT \`FK_c28e52f758e7bbc53828db92194\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`user\``);
  }
}
