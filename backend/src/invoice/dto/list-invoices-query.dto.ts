import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { InvoiceStatus } from '../entities/customer-invoice.entity';

export class ListInvoicesQueryDto {
  // partial, case-insensitive match against invoice serialNo
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
  deviceId?: number;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  // exact-match period lookup (e.g. "show March's invoices") rather than a
  // full overlap-range query — simpler, matches how an admin actually looks
  // these up (by the batch period, not an arbitrary date range)
  @IsOptional()
  @IsISO8601({ strict: true })
  billingPeriodStart?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  billingPeriodEnd?: string;
}
