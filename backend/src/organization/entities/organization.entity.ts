import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('organization')
export class Organization {
  // human-readable code, e.g. "ORG01" — this IS the orgCode used in the
  // ingestion URI (/ingest/v1/:orgCode/...), not a surrogate key
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // SHA-256 hex digest of the org's ingestion API key — see
  // ubiqedge_tech_data_model for why SHA-256 rather than bcrypt here.
  // Nullable: an org can exist before ingestion is configured for it.
  @Column({ type: 'varchar', length: 64, nullable: true })
  apiKeySecretHash: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn({ nullable: true })
  updatedAt: Date | null;
}
