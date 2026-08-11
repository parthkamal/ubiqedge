import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';

export enum DeviceTypeEnum {
  TANK = 'TANK',
  METER = 'METER',
}

@Entity('device_type')
@Unique(['type', 'orgId'])
export class DeviceType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: DeviceTypeEnum })
  type: DeviceTypeEnum;

  // METER=true, TANK=false — a flag rather than hardcoding by `type`,
  // see ubiqedge_tech_data_model open-question answer
  @Column({ type: 'boolean', default: false })
  billed: boolean;

  @Column({ type: 'varchar', length: 32 })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orgId' })
  organization: Organization;
}
