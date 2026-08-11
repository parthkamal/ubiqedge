import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { DeviceType } from '../../device/entities/device-type.entity';
import { PricingSlab } from './pricing-slab.entity';

export enum RateType {
  FIXED = 'FIXED',
  SLAB = 'SLAB',
}

// effective-date ranges for the same (orgId, deviceTypeId) must not overlap
// — enforced at the application layer, not a DB constraint. See data model.
//
// (deviceTypeId, orgId, effectiveTo) covers the "find the active config"
// lookup (effectiveTo IS NULL) — hit on every /pricing-configs/active call
// and once per device inside every invoice-generation batch loop.
@Entity('pricing_config')
@Index(['deviceTypeId', 'orgId', 'effectiveTo'])
export class PricingConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  deviceTypeId: number;

  @ManyToOne(() => DeviceType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deviceTypeId' })
  deviceType: DeviceType;

  @Column({ type: 'enum', enum: RateType })
  rateType: RateType;

  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  fixedRate: string | null;

  @Column({ type: 'datetime' })
  effectiveFrom: Date;

  @Column({ type: 'datetime', nullable: true })
  effectiveTo: Date | null;

  @OneToMany(() => PricingSlab, (slab) => slab.pricingConfig)
  slabs: PricingSlab[];

  @Column({ type: 'varchar', length: 32 })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orgId' })
  organization: Organization;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn({ nullable: true })
  updatedAt: Date | null;
}
