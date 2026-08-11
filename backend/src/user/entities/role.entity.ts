import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';

export enum RoleType {
  ADMIN = 'Admin',
  CUSTOMER = 'Customer',
}

@Entity('role')
@Unique(['type', 'orgId'])
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: RoleType })
  type: RoleType;

  @Column({ type: 'varchar', length: 255 })
  displayName: string;

  @Column({ type: 'varchar', length: 32 })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orgId' })
  organization: Organization;
}
