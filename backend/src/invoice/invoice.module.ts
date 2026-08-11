import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerInvoice } from './entities/customer-invoice.entity';
import { DeviceModule } from '../device/device.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { PricingModule } from '../pricing/pricing.module';
import { AccountModule } from '../account/account.module';
import { InvoiceController } from './invoice.controller';
import { MyInvoiceController } from './my-invoice.controller';
import { InvoiceService } from './invoice.service';

@Module({
  // Device/DeviceTypeParam repos come via DeviceModule, DeviceTelemetry via
  // TelemetryModule, PricingConfig/PricingSlab via PricingModule,
  // CustomerConnection via AccountModule — all one-directional, no cycles
  imports: [
    TypeOrmModule.forFeature([CustomerInvoice]),
    DeviceModule,
    TelemetryModule,
    PricingModule,
    AccountModule,
  ],
  controllers: [InvoiceController, MyInvoiceController],
  providers: [InvoiceService],
  exports: [TypeOrmModule],
})
export class InvoiceModule {}
