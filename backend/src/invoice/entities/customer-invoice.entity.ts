import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Device } from '../../device/entities/device.entity';
import { DeviceTelemetry } from '../../telemetry/entities/device-telemetry.entity';
import { PricingConfig } from '../../pricing/entities/pricing-config.entity';

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

// meter level, one row per device per billing period
//
// (orgId, generatedAt) covers InvoiceService.findAll/findMine — both are
// org-scoped, paginated, ORDER BY generatedAt DESC list screens that only
// get more expensive as invoices accumulate month over month.
@Entity('customer_invoice')
@Unique(['deviceId', 'billingPeriodStart', 'billingPeriodEnd'])
@Index(['orgId', 'generatedAt'])
export class CustomerInvoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64 })
  serialNo: string;

  @Column()
  deviceId: number;

  @ManyToOne(() => Device, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deviceId' })
  device: Device;

  @Column({ type: 'date' })
  billingPeriodStart: string;

  @Column({ type: 'date' })
  billingPeriodEnd: string;

  // = closingCheckpointId of this device's last non-CANCELLED invoice, or
  // earliest available reading if no prior invoice exists — see data model
  // note on the opening-checkpoint anchor query
  @Column({ type: 'bigint' })
  openingCheckpointId: string;

  @ManyToOne(() => DeviceTelemetry, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'openingCheckpointId' })
  openingCheckpoint: DeviceTelemetry;

  // latest TOTAL reading at/before period end, at generation time
  @Column({ type: 'bigint' })
  closingCheckpointId: string;

  @ManyToOne(() => DeviceTelemetry, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'closingCheckpointId' })
  closingCheckpoint: DeviceTelemetry;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  openingReading: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  closingReading: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  consumptionUnits: string;

  @Column()
  pricingConfigId: number;

  @ManyToOne(() => PricingConfig, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pricingConfigId' })
  pricingConfig: PricingConfig;

  // blended effective rate actually charged
  @Column({ type: 'decimal', precision: 12, scale: 4 })
  appliedUnitRate: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING })
  status: InvoiceStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  transactionId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  transactionProvider: string | null;

  @Column({ type: 'datetime' })
  generatedAt: Date;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

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
