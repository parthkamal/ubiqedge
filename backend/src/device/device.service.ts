import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, IsNull, Like, Repository } from 'typeorm';
import { Device } from './entities/device.entity';
import { DeviceType, DeviceTypeEnum } from './entities/device-type.entity';
import { CustomerConnection } from '../account/entities/customer-connection.entity';
import { RoleType } from '../user/entities/role.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { ListDevicesQueryDto } from './dto/list-devices-query.dto';
import { DeviceResponseDto } from './dto/device-response.dto';
import { DeviceTypeResponseDto } from './dto/device-type-response.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PaginatedResult } from '../user/user.service';

const RELATIONS = { deviceType: true, connection: true } as const;

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(
    @InjectRepository(Device) private readonly deviceRepository: Repository<Device>,
    @InjectRepository(DeviceType) private readonly deviceTypeRepository: Repository<DeviceType>,
    @InjectRepository(CustomerConnection)
    private readonly connectionRepository: Repository<CustomerConnection>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async listDeviceTypes(currentUser: AuthenticatedUser): Promise<DeviceTypeResponseDto[]> {
    const types = await this.deviceTypeRepository.find({ where: { orgId: currentUser.orgId } });
    return types.map((t) => DeviceTypeResponseDto.fromEntity(t));
  }

  async create(dto: CreateDeviceDto, currentUser: AuthenticatedUser): Promise<DeviceResponseDto> {
    const deviceType = await this.deviceTypeRepository.findOne({
      where: { type: dto.type, orgId: currentUser.orgId },
    });
    if (!deviceType) {
      this.logger.error(`Device type ${dto.type} not configured for org ${currentUser.orgId}`);
      throw new InternalServerErrorException('Device type is not configured for this organization');
    }

    let connectionId: number | null = null;
    if (dto.connectionId !== undefined) {
      const connection = await this.connectionRepository.findOne({
        where: { id: dto.connectionId, orgId: currentUser.orgId },
      });
      if (!connection) {
        throw new NotFoundException(`Account ${dto.connectionId} not found`);
      }
      connectionId = connection.id;
    }

    // serialNo is derived from the row's own auto-increment id, same
    // two-step transaction pattern as customer_connection.accountNo
    const saved = await this.dataSource.transaction(async (manager) => {
      const device = manager.create(Device, {
        name: dto.name,
        serialNo: `PENDING-${Date.now()}`,
        deviceTypeId: deviceType.id,
        connectionId,
        orgId: currentUser.orgId,
      });
      const inserted = await manager.save(device);
      inserted.serialNo = this.formatSerialNo(currentUser.orgId, dto.type, inserted.id);
      return manager.save(inserted);
    });

    return this.reloadResponse(saved.id, currentUser.orgId);
  }

  async findAll(
    query: ListDevicesQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<DeviceResponseDto>> {
    const baseWhere: FindOptionsWhere<Device> = { orgId: currentUser.orgId };
    if (query.connectionId !== undefined) {
      baseWhere.connectionId = query.connectionId;
    }
    // unassigned=true is the more specific, deliberate filter — takes
    // precedence over connectionId if both are somehow sent together
    if (query.unassigned) {
      baseWhere.connectionId = IsNull();
    }
    if (query.type) {
      baseWhere.deviceType = { type: query.type };
    }
    // OR across name/serialNo — array of where clauses is TypeORM's way to
    // express OR while still AND-ing each with baseWhere
    const where: FindOptionsWhere<Device> | FindOptionsWhere<Device>[] = query.search
      ? [
          { ...baseWhere, name: Like(`%${query.search}%`) },
          { ...baseWhere, serialNo: Like(`%${query.search}%`) },
        ]
      : baseWhere;

    const [devices, total] = await this.deviceRepository.findAndCount({
      where,
      relations: RELATIONS,
      order: { id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return {
      data: devices.map((d) => DeviceResponseDto.fromEntity(d)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  // no pagination — a customer's own meter/tank count is inherently small
  // and bounded, unlike the admin's org-wide listing
  async findMine(currentUser: AuthenticatedUser): Promise<DeviceResponseDto[]> {
    const connection = await this.connectionRepository.findOne({
      where: { userId: currentUser.userId, orgId: currentUser.orgId },
    });
    if (!connection) {
      return [];
    }
    const devices = await this.deviceRepository.find({
      where: { connectionId: connection.id, orgId: currentUser.orgId },
      relations: RELATIONS,
      order: { id: 'ASC' },
    });
    return devices.map((d) => DeviceResponseDto.fromEntity(d));
  }

  async findOne(id: number, currentUser: AuthenticatedUser): Promise<DeviceResponseDto> {
    const device = await this.getScopedEntity(id, currentUser.orgId);

    // Admin or the owning Customer only — a Customer requesting a device
    // that isn't theirs gets the same 404 as a nonexistent id, not 403,
    // so existence of other customers' devices is never confirmed
    if (currentUser.roleType === RoleType.CUSTOMER && device.connection?.userId !== currentUser.userId) {
      throw new NotFoundException(`Device ${id} not found`);
    }
    return DeviceResponseDto.fromEntity(device);
  }

  async update(
    id: number,
    dto: UpdateDeviceDto,
    currentUser: AuthenticatedUser,
  ): Promise<DeviceResponseDto> {
    const device = await this.getScopedEntity(id, currentUser.orgId);

    if (dto.name !== undefined) device.name = dto.name;
    if (dto.isActive !== undefined) device.isActive = dto.isActive;
    if (dto.connectionId !== undefined) {
      if (dto.connectionId === null) {
        // must null out both — device was fetched with the `connection`
        // relation eagerly loaded, and TypeORM re-derives the FK column
        // from that relation object on save, silently overriding a
        // scalar-only assignment to connectionId
        device.connectionId = null;
        device.connection = null;
      } else {
        const connection = await this.connectionRepository.findOne({
          where: { id: dto.connectionId, orgId: currentUser.orgId },
        });
        if (!connection) {
          throw new NotFoundException(`Account ${dto.connectionId} not found`);
        }
        device.connectionId = connection.id;
        device.connection = connection;
      }
    }

    await this.deviceRepository.save(device);
    return this.reloadResponse(id, currentUser.orgId);
  }

  async remove(id: number, currentUser: AuthenticatedUser): Promise<void> {
    const device = await this.getScopedEntity(id, currentUser.orgId);
    await this.deviceRepository.softRemove(device);
  }

  private formatSerialNo(orgId: string, type: DeviceTypeEnum, id: number): string {
    return `${orgId}-${type}-${id.toString().padStart(6, '0')}`;
  }

  // reloads relations fresh rather than trusting the in-memory entity post
  // save — cheap, and avoids the class of bug documented in
  // feedback_partial_update_bug (stale/incomplete in-memory state leaking
  // into the response)
  private async reloadResponse(id: number, orgId: string): Promise<DeviceResponseDto> {
    const device = await this.getScopedEntity(id, orgId);
    return DeviceResponseDto.fromEntity(device);
  }

  private async getScopedEntity(id: number, orgId: string): Promise<Device> {
    const device = await this.deviceRepository.findOne({
      where: { id, orgId },
      relations: RELATIONS,
    });
    if (!device) {
      throw new NotFoundException(`Device ${id} not found`);
    }
    return device;
  }
}
