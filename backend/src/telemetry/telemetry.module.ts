import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceTelemetry } from './entities/device-telemetry.entity';
import { DeviceModule } from '../device/device.module';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  // DeviceTypeParam repository comes in via DeviceModule's exported
  // TypeOrmModule — not re-registered here
  imports: [TypeOrmModule.forFeature([DeviceTelemetry]), DeviceModule],
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TypeOrmModule],
})
export class TelemetryModule {}
