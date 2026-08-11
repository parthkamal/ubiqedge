import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { PricingConfig, RateType } from './entities/pricing-config.entity';
import { PricingSlab } from './entities/pricing-slab.entity';
import { DeviceType } from '../device/entities/device-type.entity';
import { CreatePricingConfigDto } from './dto/create-pricing-config.dto';
import { CreatePricingSlabDto } from './dto/create-pricing-slab.dto';
import { ListPricingConfigsQueryDto } from './dto/list-pricing-configs-query.dto';
import { ActivePricingConfigQueryDto } from './dto/active-pricing-config-query.dto';
import { PricingConfigResponseDto } from './dto/pricing-config-response.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PaginatedResult } from '../user/user.service';

const RELATIONS = { deviceType: true, slabs: true } as const;

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PricingConfig) private readonly configRepository: Repository<PricingConfig>,
    @InjectRepository(DeviceType) private readonly deviceTypeRepository: Repository<DeviceType>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreatePricingConfigDto,
    currentUser: AuthenticatedUser,
  ): Promise<PricingConfigResponseDto> {
    const deviceType = await this.deviceTypeRepository.findOne({
      where: { type: dto.type, orgId: currentUser.orgId },
    });
    if (!deviceType) {
      throw new NotFoundException(`Device type ${dto.type} not found`);
    }
    if (!deviceType.billed) {
      throw new BadRequestException(`${dto.type} is not a billed device type — pricing doesn't apply`);
    }

    if (dto.rateType === RateType.SLAB) {
      this.validateSlabStructure(dto.slabs ?? []);
    }

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();

    const saved = await this.dataSource.transaction(async (manager) => {
      // auto-close whatever config is currently active for this device type,
      // so coverage stays contiguous with no gap or overlap
      const active = await manager.findOne(PricingConfig, {
        where: { deviceTypeId: deviceType.id, orgId: currentUser.orgId, effectiveTo: IsNull() },
      });
      if (active) {
        active.effectiveTo = effectiveFrom;
        await manager.save(active);
      }

      const config = manager.create(PricingConfig, {
        deviceTypeId: deviceType.id,
        rateType: dto.rateType,
        fixedRate: dto.rateType === RateType.FIXED ? String(dto.fixedRate) : null,
        effectiveFrom,
        effectiveTo: null,
        orgId: currentUser.orgId,
      });
      const insertedConfig = await manager.save(config);

      let slabs: PricingSlab[] = [];
      if (dto.rateType === RateType.SLAB) {
        const slabEntities = (dto.slabs ?? []).map((s) =>
          manager.create(PricingSlab, {
            pricingConfigId: insertedConfig.id,
            slabFrom: String(s.slabFrom),
            slabTo: s.slabTo !== undefined ? String(s.slabTo) : null,
            rate: String(s.rate),
          }),
        );
        slabs = await manager.save(slabEntities);
      }

      insertedConfig.deviceType = deviceType;
      return { config: insertedConfig, slabs };
    });

    return PricingConfigResponseDto.fromEntity(saved.config, saved.slabs);
  }

  async findAll(
    query: ListPricingConfigsQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<PricingConfigResponseDto>> {
    const where: FindOptionsWhere<PricingConfig> = { orgId: currentUser.orgId };
    if (query.type) {
      where.deviceType = { type: query.type };
    }

    const [configs, total] = await this.configRepository.findAndCount({
      where,
      relations: RELATIONS,
      order: { effectiveFrom: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return {
      data: configs.map((c) => PricingConfigResponseDto.fromEntity(c, c.slabs)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async findActive(
    query: ActivePricingConfigQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PricingConfigResponseDto> {
    const deviceType = await this.deviceTypeRepository.findOne({
      where: { type: query.type, orgId: currentUser.orgId },
    });
    if (!deviceType) {
      throw new NotFoundException(`Device type ${query.type} not found`);
    }

    const config = await this.configRepository.findOne({
      where: { deviceTypeId: deviceType.id, orgId: currentUser.orgId, effectiveTo: IsNull() },
      relations: RELATIONS,
    });
    if (!config) {
      throw new NotFoundException(`No active pricing config for ${query.type}`);
    }
    return PricingConfigResponseDto.fromEntity(config, config.slabs);
  }

  // enforces: sorted, starts at 0, contiguous (no gaps/overlaps between
  // tiers), and only the last tier is unbounded — the invoice generation
  // logic (walking tiers to compute a bill) assumes this shape holds
  private validateSlabStructure(slabs: CreatePricingSlabDto[]): void {
    const sorted = [...slabs].sort((a, b) => a.slabFrom - b.slabFrom);

    if (sorted[0].slabFrom !== 0) {
      throw new BadRequestException('The first slab must start at 0');
    }

    for (let i = 0; i < sorted.length; i++) {
      const slab = sorted[i];
      const isLast = i === sorted.length - 1;

      if (isLast) {
        if (slab.slabTo !== undefined) {
          throw new BadRequestException('Only the last slab may omit slabTo (unbounded)');
        }
        continue;
      }

      if (slab.slabTo === undefined) {
        throw new BadRequestException('Every slab except the last must specify slabTo');
      }
      if (slab.slabTo <= slab.slabFrom) {
        throw new BadRequestException('Each slab\'s slabTo must be greater than its slabFrom');
      }
      if (slab.slabTo !== sorted[i + 1].slabFrom) {
        throw new BadRequestException(
          'Slabs must be contiguous — each slabTo must equal the next slab\'s slabFrom',
        );
      }
    }
  }
}
