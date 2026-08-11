import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListAccountsQueryDto {
  // partial, case-insensitive match against accountNo/user firstName/lastName/email
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

  // exact-match lookup — e.g. "does this user already have an account, and
  // which one" from the admin Users screen
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;
}
