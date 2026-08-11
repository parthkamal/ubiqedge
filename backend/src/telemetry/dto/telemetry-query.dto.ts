import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ParamKey } from '../../device/entities/device-type-param.entity';

export enum TelemetryRangePreset {
  DAY = '1d',
  WEEK = '7d',
  MONTH = '30d',
  CUSTOM = 'custom',
}

export class TelemetryQueryDto {
  // preset windows for the common chart cases (1 day/7 days/1 month) so
  // clients don't hand-compute date arithmetic and can't accidentally
  // request an unbounded/huge range — omit for the legacy from/to-driven
  // behavior (7-day default), or set range=custom and provide both from/to
  // explicitly for an arbitrary window
  @IsOptional()
  @IsEnum(TelemetryRangePreset)
  range?: TelemetryRangePreset;

  // required together when range=custom; otherwise optional overrides of
  // the legacy default-7-day-window behavior — validated in the service,
  // not here, since "required" depends on `range`'s value
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsEnum(ParamKey)
  paramKey?: ParamKey;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 100;
}
