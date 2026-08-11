import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { PricingConfig } from './pricing-config.entity';

// children of a pricing_config where rateType = SLAB
@Entity('pricing_slab')
@Unique(['pricingConfigId', 'slabFrom'])
export class PricingSlab {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  pricingConfigId: number;

  @ManyToOne(() => PricingConfig, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pricingConfigId' })
  pricingConfig: PricingConfig;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  slabFrom: string;

  // null = unbounded, i.e. the last tier
  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  slabTo: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  rate: string;
}
