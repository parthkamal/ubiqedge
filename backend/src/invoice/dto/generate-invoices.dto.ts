import { IsISO8601, IsOptional } from 'class-validator';

// omit both to default to the previous calendar month; if provided, both
// are required together — enforced in the service (simpler and more
// precise than chaining ValidateIf between two mutually-dependent fields)
export class GenerateInvoicesDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  billingPeriodStart?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  billingPeriodEnd?: string;
}
