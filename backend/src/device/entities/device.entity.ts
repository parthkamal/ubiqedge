import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { DeviceType } from './device-type.entity';
import { CustomerConnection } from '../../account/entities/customer-connection.entity';

// meter or tank
@Entity('device')
@Unique(['serialNo', 'orgId'])
export class Device {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 64 })
  serialNo: string;

  @Column()
  deviceTypeId: number;

  @ManyToOne(() => DeviceType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deviceTypeId' })
  deviceType: DeviceType;

  // nullable: admin can add a meter to inventory before it's linked to a
  // customer account — see ubiqedge_tech_data_model
  @Column({ type: 'int', nullable: true })
  connectionId: number | null;

  @ManyToOne(() => CustomerConnection, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'connectionId' })
  connection: CustomerConnection | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 32 })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orgId' })
  organization: Organization;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn({ nullable: true })
  updatedAt: Date | null;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
