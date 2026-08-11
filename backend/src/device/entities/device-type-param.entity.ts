import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { DeviceType } from './device-type.entity';

// paramKey is immutable once created — see ubiqedge_tech_data_model
export enum ParamKey {
  LEVEL = 'LEVEL',
  TOTAL = 'TOTAL',
  FLOW = 'FLOW',
}

export enum ParamDataType {
  NUMERIC = 'numeric',
}

@Entity('device_type_param')
@Unique(['paramKey', 'orgId'])
export class DeviceTypeParam {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  deviceTypeId: number;

  @ManyToOne(() => DeviceType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deviceTypeId' })
  deviceType: DeviceType;

  @Column({ type: 'enum', enum: ParamKey })
  paramKey: ParamKey;

  @Column({ type: 'varchar', length: 255 })
  displayName: string;

  @Column({ type: 'enum', enum: ParamDataType, default: ParamDataType.NUMERIC })
  dataType: ParamDataType;

  @Column({ type: 'varchar', length: 32 })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orgId' })
  organization: Organization;
}
