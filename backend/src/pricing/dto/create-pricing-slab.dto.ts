import { IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class CreatePricingSlabDto {
  @IsNumber()
  @Min(0)
  slabFrom: number;

  // omit only on the last tier — unbounded upper end
  @IsOptional()
  @IsNumber()
  @IsPositive()
  slabTo?: number;

  @IsNumber()
  @IsPositive()
  rate: number;
}
