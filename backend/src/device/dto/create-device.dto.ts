import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { DeviceTypeEnum } from '../entities/device-type.entity';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(DeviceTypeEnum)
  type: DeviceTypeEnum;

  // omit to add to inventory unassigned — link to an account later via PATCH
  @IsOptional()
  @IsInt()
  @Min(1)
  connectionId?: number;
}
