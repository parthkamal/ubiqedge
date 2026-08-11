import { User } from '../entities/user.entity';
import { RoleType } from '../entities/role.entity';

// never includes passwordHash — this is what a User entity maps to on the
// way out, never the raw entity
export class UserResponseDto {
  id: number;
  firstName: string;
  lastName: string | null;
  isActive: boolean;
  email: string;
  phoneNumber: string;
  address: string;
  pincode: string;
  roleType: RoleType;
  createdAt: Date;
  updatedAt: Date | null;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.isActive = user.isActive;
    dto.email = user.email;
    dto.phoneNumber = user.phoneNumber;
    dto.address = user.address;
    dto.pincode = user.pincode;
    dto.roleType = user.role.type;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
