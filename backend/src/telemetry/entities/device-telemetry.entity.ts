import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Device } from '../../device/entities/device.entity';
import { DeviceType } from '../../device/entities/device-type.entity';
import { DeviceTypeParam } from '../../device/entities/device-type-param.entity';

@Entity('device_telemetry')
// orgId leads so this index also serves tenant-scoped time-window scans for
// the consumption view — see ubiqedge_tech_data_model
@Unique(['orgId', 'deviceId', 'deviceTypeParamId', 'deviceTimestamp'])
export class DeviceTelemetry {
  // bigint PKs come back as strings from mysql2 — expected, not a bug
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column()
  deviceId: number;

  @ManyToOne(() => Device, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deviceId' })
  device: Device;

  @Column()
  deviceTypeId: number;

  @ManyToOne(() => DeviceType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deviceTypeId' })
  deviceType: DeviceType;

  @Column()
  deviceTypeParamId: number;

  @ManyToOne(() => DeviceTypeParam, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deviceTypeParamId' })
  deviceTypeParam: DeviceTypeParam;

  // decimal columns come back as strings via mysql2 — kept as string here
  // deliberately, to avoid float rounding on billing-relevant readings
  @Column({ type: 'decimal', precision: 18, scale: 4 })
  value: string;

  @Column({ type: 'datetime' })
  serverTimestamp: Date;

  @Column({ type: 'datetime' })
  deviceTimestamp: Date;

  @Column({ type: 'varchar', length: 32 })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orgId' })
  organization: Organization;
}
