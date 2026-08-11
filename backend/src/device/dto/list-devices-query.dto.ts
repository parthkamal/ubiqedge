import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DeviceTypeEnum } from '../entities/device-type.entity';

export class ListDevicesQueryDto {
  // partial, case-insensitive match against name/serialNo
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  connectionId?: number;

  @IsOptional()
  @IsEnum(DeviceTypeEnum)
  type?: DeviceTypeEnum;

  // true = only devices with connectionId IS NULL (not yet linked)
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unassigned?: boolean;
}
