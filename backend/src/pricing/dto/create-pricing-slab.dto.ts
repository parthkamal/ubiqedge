import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class CreatePricingSlabDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  slabFrom: number;

  // omit only on the last tier — unbounded upper end
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  slabTo?: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  rate: number;
}
