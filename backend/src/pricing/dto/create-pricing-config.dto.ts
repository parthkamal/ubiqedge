import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DeviceTypeEnum } from '../../device/entities/device-type.entity';
import { RateType } from '../entities/pricing-config.entity';
import { CreatePricingSlabDto } from './create-pricing-slab.dto';

export class CreatePricingConfigDto {
  @IsEnum(DeviceTypeEnum)
  type: DeviceTypeEnum;

  @IsEnum(RateType)
  rateType: RateType;

  @ValidateIf((dto: CreatePricingConfigDto) => dto.rateType === RateType.FIXED)
  @IsNumber()
  @IsPositive()
  fixedRate?: number;

  @ValidateIf((dto: CreatePricingConfigDto) => dto.rateType === RateType.SLAB)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePricingSlabDto)
  slabs?: CreatePricingSlabDto[];

  // omit to start now
  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;
}
