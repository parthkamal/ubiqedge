import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Like, Repository } from 'typeorm';
import { CustomerConnection } from './entities/customer-connection.entity';
import { User } from '../user/entities/user.entity';
import { RoleType } from '../user/entities/role.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { AccountResponseDto } from './dto/account-response.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PaginatedResult } from '../user/user.service';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(CustomerConnection)
    private readonly connectionRepository: Repository<CustomerConnection>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateAccountDto, currentUser: AuthenticatedUser): Promise<AccountResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: dto.userId, orgId: currentUser.orgId },
      relations: { role: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${dto.userId} not found`);
    }
    if (user.role.type !== RoleType.CUSTOMER) {
      throw new BadRequestException('Only Customer users can have an account');
    }

    const existing = await this.connectionRepository.findOne({ where: { userId: dto.userId } });
    if (existing) {
      throw new ConflictException('This user already has an account');
    }

    // accountNo is derived from the row's own auto-increment id, so it's
    // created in two steps inside one transaction: insert with a placeholder
    // that satisfies the NOT NULL constraint, then set the real value once
    // the id exists
    const saved = await this.dataSource.transaction(async (manager) => {
      const connection = manager.create(CustomerConnection, {
        accountNo: `PENDING-${Date.now()}`,
        userId: dto.userId,
        orgId: currentUser.orgId,
      });
      const inserted = await manager.save(connection);
      inserted.accountNo = this.formatAccountNo(currentUser.orgId, inserted.id);
      return manager.save(inserted);
    });

    saved.user = user;
    return AccountResponseDto.fromEntity(saved);
  }

  async findAll(
    query: ListAccountsQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<AccountResponseDto>> {
    const baseWhere: FindOptionsWhere<CustomerConnection> = { orgId: currentUser.orgId };
    if (query.userId !== undefined) {
      baseWhere.userId = query.userId;
    }
    // OR across accountNo/user firstName/lastName/email — array of where
    // clauses is TypeORM's way to express OR while still AND-ing each with
    // baseWhere, same pattern as UserService/DeviceService.findAll
    const where: FindOptionsWhere<CustomerConnection> | FindOptionsWhere<CustomerConnection>[] = query.search
      ? [
          { ...baseWhere, accountNo: Like(`%${query.search}%`) },
          { ...baseWhere, user: { firstName: Like(`%${query.search}%`) } },
          { ...baseWhere, user: { lastName: Like(`%${query.search}%`) } },
          { ...baseWhere, user: { email: Like(`%${query.search}%`) } },
        ]
      : baseWhere;

    const [accounts, total] = await this.connectionRepository.findAndCount({
      where,
      relations: { user: true },
      order: { id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return {
      data: accounts.map((a) => AccountResponseDto.fromEntity(a)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async findOne(id: number, currentUser: AuthenticatedUser): Promise<AccountResponseDto> {
    const connection = await this.getScopedEntity({ id, orgId: currentUser.orgId });
    return AccountResponseDto.fromEntity(connection);
  }

  async findMine(currentUser: AuthenticatedUser): Promise<AccountResponseDto> {
    const connection = await this.getScopedEntity({
      userId: currentUser.userId,
      orgId: currentUser.orgId,
    });
    return AccountResponseDto.fromEntity(connection);
  }

  async updateStatus(
    id: number,
    dto: UpdateAccountStatusDto,
    currentUser: AuthenticatedUser,
  ): Promise<AccountResponseDto> {
    const connection = await this.getScopedEntity({ id, orgId: currentUser.orgId });
    connection.status = dto.status;
    const saved = await this.connectionRepository.save(connection);
    return AccountResponseDto.fromEntity(saved);
  }

  private formatAccountNo(orgId: string, id: number): string {
    return `${orgId}-${id.toString().padStart(6, '0')}`;
  }

  private async getScopedEntity(
    where: { id?: number; userId?: number; orgId: string },
  ): Promise<CustomerConnection> {
    const connection = await this.connectionRepository.findOne({
      where,
      relations: { user: true },
    });
    if (!connection) {
      throw new NotFoundException('Account not found');
    }
    return connection;
  }
}
