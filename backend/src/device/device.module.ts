import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './entities/device.entity';
import { DeviceType } from './entities/device-type.entity';
import { DeviceTypeParam } from './entities/device-type-param.entity';
import { AccountModule } from '../account/account.module';
import { DeviceController } from './device.controller';
import { DeviceTypeController } from './device-type.controller';
import { MyDeviceController } from './my-device.controller';
import { DeviceService } from './device.service';

@Module({
  imports: [TypeOrmModule.forFeature([Device, DeviceType, DeviceTypeParam]), AccountModule],
  controllers: [DeviceController, DeviceTypeController, MyDeviceController],
  providers: [DeviceService],
  exports: [TypeOrmModule, DeviceService],
})
export class DeviceModule {}
