import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingConfig } from './entities/pricing-config.entity';
import { PricingSlab } from './entities/pricing-slab.entity';
import { DeviceModule } from '../device/device.module';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  // DeviceType repository comes in via DeviceModule's exported TypeOrmModule
  imports: [TypeOrmModule.forFeature([PricingConfig, PricingSlab]), DeviceModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [TypeOrmModule],
})
export class PricingModule {}
