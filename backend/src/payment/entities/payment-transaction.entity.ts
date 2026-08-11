import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { CustomerInvoice } from '../../invoice/entities/customer-invoice.entity';

export enum PaymentStatus {
  INITIATED = 'INITIATED',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('payment_transaction')
@Unique(['provider', 'providerTransactionId'])
export class PaymentTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  invoiceId: number;

  @ManyToOne(() => CustomerInvoice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: CustomerInvoice;

  @Column({ type: 'varchar', length: 64 })
  provider: string;

  @Column({ type: 'varchar', length: 255 })
  providerTransactionId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: PaymentStatus })
  status: PaymentStatus;

  // webhook payload, kept for audit
  @Column({ type: 'json', nullable: true })
  rawPayload: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 32 })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orgId' })
  organization: Organization;

  @CreateDateColumn()
  createdAt: Date;
}
