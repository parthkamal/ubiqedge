import { PricingConfig, RateType } from '../entities/pricing-config.entity';
import { PricingSlab } from '../entities/pricing-slab.entity';
import { DeviceTypeEnum } from '../../device/entities/device-type.entity';

class PricingSlabResponse {
  slabFrom: string;
  slabTo: string | null;
  rate: string;
}

export class PricingConfigResponseDto {
  id: number;
  type: DeviceTypeEnum;
  rateType: RateType;
  fixedRate: string | null;
  slabs: PricingSlabResponse[];
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;

  static fromEntity(config: PricingConfig, slabs: PricingSlab[] = []): PricingConfigResponseDto {
    const dto = new PricingConfigResponseDto();
    dto.id = config.id;
    dto.type = config.deviceType.type;
    dto.rateType = config.rateType;
    dto.fixedRate = config.fixedRate;
    dto.slabs = slabs
      .sort((a, b) => Number(a.slabFrom) - Number(b.slabFrom))
      .map((s) => ({ slabFrom: s.slabFrom, slabTo: s.slabTo, rate: s.rate }));
    dto.effectiveFrom = config.effectiveFrom;
    dto.effectiveTo = config.effectiveTo;
    dto.createdAt = config.createdAt;
    return dto;
  }
}
