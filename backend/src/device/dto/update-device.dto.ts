import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// deliberately excludes `type` — a device's physical type (METER/TANK)
// shouldn't change after creation, telemetry validation depends on it
export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // send null to unassign from its current account, a number to
  // (re)assign, or omit to leave untouched
  @IsOptional()
  @IsInt()
  connectionId?: number | null;
}
