import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

// deliberately excludes email/password/roleType — those need dedicated,
// more sensitive flows, not a generic PATCH
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @Matches(/^[0-9]{7,15}$/, { message: 'phoneNumber must be 7-15 digits' })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string;

  @IsOptional()
  @Matches(/^[0-9]{4,10}$/, { message: 'pincode must be 4-10 digits' })
  pincode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
