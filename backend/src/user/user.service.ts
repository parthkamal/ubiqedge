import { ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Like, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const BCRYPT_ROUNDS = 10;

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
  ) {}

  async create(dto: CreateUserDto, currentUser: AuthenticatedUser): Promise<UserResponseDto> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const role = await this.roleRepository.findOne({
      where: { type: dto.roleType, orgId: currentUser.orgId },
    });
    if (!role) {
      // an org missing one of its two seeded roles is a setup bug, not a
      // client error — log it with enough context to actually debug
      this.logger.error(`Role ${dto.roleType} not configured for org ${currentUser.orgId}`);
      throw new InternalServerErrorException('Role is not configured for this organization');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = this.userRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName ?? null,
      email: dto.email,
      passwordHash,
      phoneNumber: dto.phoneNumber,
      address: dto.address,
      pincode: dto.pincode,
      orgId: currentUser.orgId,
      roleId: role.id,
    });
    const saved = await this.userRepository.save(user);
    saved.role = role;
    return UserResponseDto.fromEntity(saved);
  }

  async findAll(
    query: ListUsersQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<UserResponseDto>> {
    const baseWhere: FindOptionsWhere<User> = { orgId: currentUser.orgId };
    if (query.roleType) {
      baseWhere.role = { type: query.roleType };
    }
    // OR across firstName/lastName/email — an array of where clauses is
    // TypeORM's way to express OR while still AND-ing each with baseWhere
    const where: FindOptionsWhere<User> | FindOptionsWhere<User>[] = query.search
      ? [
          { ...baseWhere, firstName: Like(`%${query.search}%`) },
          { ...baseWhere, lastName: Like(`%${query.search}%`) },
          { ...baseWhere, email: Like(`%${query.search}%`) },
        ]
      : baseWhere;

    const [users, total] = await this.userRepository.findAndCount({
      where,
      relations: { role: true },
      order: { id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return {
      data: users.map((u) => UserResponseDto.fromEntity(u)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async findMe(currentUser: AuthenticatedUser): Promise<UserResponseDto> {
    return this.findScoped(currentUser.userId, currentUser.orgId);
  }

  async findOne(id: number, currentUser: AuthenticatedUser): Promise<UserResponseDto> {
    return this.findScoped(id, currentUser.orgId);
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const user = await this.getScopedEntity(id, currentUser.orgId);
    // explicit per-field assignment, not Object.assign(user, dto): dto's
    // declared-but-unsent optional fields exist as own properties valued
    // `undefined` (useDefineForClassFields), so a blanket Object.assign
    // overwrites real values with undefined for every field the caller
    // didn't actually send
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.pincode !== undefined) user.pincode = dto.pincode;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    const saved = await this.userRepository.save(user);
    return UserResponseDto.fromEntity(saved);
  }

  async remove(id: number, currentUser: AuthenticatedUser): Promise<void> {
    const user = await this.getScopedEntity(id, currentUser.orgId);
    await this.userRepository.softRemove(user);
  }

  private async findScoped(id: number, orgId: string): Promise<UserResponseDto> {
    const user = await this.getScopedEntity(id, orgId);
    return UserResponseDto.fromEntity(user);
  }

  // orgId scoping happens here, not at the controller — a user from another
  // org 404s rather than 403ing, so we don't confirm its existence at all
  private async getScopedEntity(id: number, orgId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, orgId },
      relations: { role: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }
}
