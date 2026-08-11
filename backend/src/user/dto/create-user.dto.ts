import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { RoleType } from '../entities/role.entity';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @Matches(/^[0-9]{7,15}$/, { message: 'phoneNumber must be 7-15 digits' })
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @Matches(/^[0-9]{4,10}$/, { message: 'pincode must be 4-10 digits' })
  pincode: string;

  @IsEnum(RoleType)
  roleType: RoleType;
}
