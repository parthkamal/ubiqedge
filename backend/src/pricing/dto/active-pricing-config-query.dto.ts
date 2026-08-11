import { IsEnum } from 'class-validator';
import { DeviceTypeEnum } from '../../device/entities/device-type.entity';

export class ActivePricingConfigQueryDto {
  @IsEnum(DeviceTypeEnum)
  type: DeviceTypeEnum;
}
