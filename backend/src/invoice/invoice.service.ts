import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, IsNull, Like, LessThanOrEqual, Not, QueryFailedError, Repository } from 'typeorm';
import { CustomerInvoice, InvoiceStatus } from './entities/customer-invoice.entity';
import { Device } from '../device/entities/device.entity';
import { DeviceTelemetry } from '../telemetry/entities/device-telemetry.entity';
import { DeviceTypeParam, ParamKey } from '../device/entities/device-type-param.entity';
import { PricingConfig, RateType } from '../pricing/entities/pricing-config.entity';
import { CustomerConnection } from '../account/entities/customer-connection.entity';
import { RoleType } from '../user/entities/role.entity';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { GenerateInvoicesResultDto } from './dto/generate-invoices-result.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { ListMyInvoicesQueryDto } from './dto/list-my-invoices-query.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PaginatedResult } from '../user/user.service';

const DUE_DAYS = 15;

type DeviceOutcome = { status: 'generated' } | { status: 'skipped'; reason: string };

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(CustomerInvoice) private readonly invoiceRepository: Repository<CustomerInvoice>,
    @InjectRepository(Device) private readonly deviceRepository: Repository<Device>,
    @InjectRepository(DeviceTelemetry) private readonly telemetryRepository: Repository<DeviceTelemetry>,
    @InjectRepository(DeviceTypeParam)
    private readonly deviceTypeParamRepository: Repository<DeviceTypeParam>,
    @InjectRepository(PricingConfig) private readonly pricingConfigRepository: Repository<PricingConfig>,
    @InjectRepository(CustomerConnection)
    private readonly connectionRepository: Repository<CustomerConnection>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // per FR: "Admin can generate invoices for all meters for previous month"
  // — this is the one and only entry point, called by the admin-triggered
  // controller. No background schedule. See implementation spec §4.
  async generateForPeriod(
    dto: GenerateInvoicesDto,
    currentUser: AuthenticatedUser,
  ): Promise<GenerateInvoicesResultDto> {
    if ((dto.billingPeriodStart === undefined) !== (dto.billingPeriodEnd === undefined)) {
      throw new BadRequestException('billingPeriodStart and billingPeriodEnd must be provided together');
    }

    const { start, end } =
      dto.billingPeriodStart && dto.billingPeriodEnd
        ? { start: new Date(dto.billingPeriodStart), end: new Date(dto.billingPeriodEnd) }
        : this.previousCalendarMonth();
    // both `start` and `end` parse/compute to midnight UTC of their date —
    // fine as a lower bound, but `end` is used as an inclusive upper bound
    // against telemetry timestamps, so it must cover the whole day or every
    // reading actually on that calendar day gets wrongly excluded
    end.setUTCHours(23, 59, 59, 999);

    if (start > end) {
      throw new BadRequestException('billingPeriodStart must be before billingPeriodEnd');
    }

    const totalParam = await this.deviceTypeParamRepository.findOne({
      where: { paramKey: ParamKey.TOTAL, orgId: currentUser.orgId },
    });
    if (!totalParam) {
      throw new BadRequestException(
        'TOTAL telemetry parameter is not configured for this organization — cannot generate invoices',
      );
    }

    const devices = await this.deviceRepository.find({
      where: {
        orgId: currentUser.orgId,
        isActive: true,
        connectionId: Not(IsNull()),
        deviceType: { billed: true },
      },
      relations: { deviceType: true },
    });

    const skipped: { deviceId: number; reason: string }[] = [];
    let generated = 0;

    for (const device of devices) {
      try {
        const outcome = await this.generateForDevice(device, end, currentUser.orgId, totalParam.id);
        if (outcome.status === 'generated') {
          generated++;
        } else {
          skipped.push({ deviceId: device.id, reason: outcome.reason });
        }
      } catch (err) {
        if (err instanceof QueryFailedError) {
          // unique(deviceId, billingPeriodStart, billingPeriodEnd) — this
          // exact period was already invoiced for this device, safe no-op
          skipped.push({ deviceId: device.id, reason: 'already invoiced for this period' });
        } else {
          this.logger.error(
            `Invoice generation failed for device ${device.id}: ${err instanceof Error ? err.message : err}`,
            err instanceof Error ? err.stack : undefined,
          );
          skipped.push({ deviceId: device.id, reason: 'unexpected error — see server logs' });
        }
      }
    }

    return {
      billingPeriodStart: this.formatDate(start),
      billingPeriodEnd: this.formatDate(end),
      generated,
      skipped,
    };
  }

  async findAll(
    query: ListInvoicesQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<InvoiceResponseDto>> {
    const where: FindOptionsWhere<CustomerInvoice> = { orgId: currentUser.orgId };
    if (query.deviceId !== undefined) where.deviceId = query.deviceId;
    if (query.status) where.status = query.status;
    if (query.billingPeriodStart) where.billingPeriodStart = query.billingPeriodStart.slice(0, 10);
    if (query.billingPeriodEnd) where.billingPeriodEnd = query.billingPeriodEnd.slice(0, 10);
    if (query.search) where.serialNo = Like(`%${query.search}%`);

    const [invoices, total] = await this.invoiceRepository.findAndCount({
      where,
      relations: { device: true },
      order: { generatedAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return {
      data: invoices.map((i) => InvoiceResponseDto.fromEntity(i)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async findMine(
    query: ListMyInvoicesQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<InvoiceResponseDto>> {
    const connection = await this.connectionRepository.findOne({
      where: { userId: currentUser.userId, orgId: currentUser.orgId },
    });
    if (!connection) {
      return { data: [], meta: { page: query.page, limit: query.limit, total: 0 } };
    }

    const devices = await this.deviceRepository.find({
      where: { connectionId: connection.id, orgId: currentUser.orgId },
    });
    if (devices.length === 0) {
      return { data: [], meta: { page: query.page, limit: query.limit, total: 0 } };
    }

    const where: FindOptionsWhere<CustomerInvoice> = {
      orgId: currentUser.orgId,
      deviceId: In(devices.map((d) => d.id)),
    };
    if (query.status) where.status = query.status;
    if (query.search) where.serialNo = Like(`%${query.search}%`);

    const [invoices, total] = await this.invoiceRepository.findAndCount({
      where,
      relations: { device: true },
      order: { generatedAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return {
      data: invoices.map((i) => InvoiceResponseDto.fromEntity(i)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async findOne(id: number, currentUser: AuthenticatedUser): Promise<InvoiceResponseDto> {
    const invoice = await this.getScopedEntity(id, currentUser.orgId);

    // Admin or the owning Customer only, same pattern as DeviceService —
    // 404, not 403, so another customer's invoice existence isn't confirmed
    if (
      currentUser.roleType === RoleType.CUSTOMER &&
      invoice.device.connection?.userId !== currentUser.userId
    ) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    return InvoiceResponseDto.fromEntity(invoice);
  }

  async cancel(id: number, currentUser: AuthenticatedUser): Promise<InvoiceResponseDto> {
    const invoice = await this.getScopedEntity(id, currentUser.orgId);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot cancel a paid invoice');
    }
    invoice.status = InvoiceStatus.CANCELLED;
    const saved = await this.invoiceRepository.save(invoice);
    return InvoiceResponseDto.fromEntity(saved);
  }

  private async generateForDevice(
    device: Device,
    periodEnd: Date,
    orgId: string,
    totalParamId: number,
  ): Promise<DeviceOutcome> {
    // opening checkpoint: last non-CANCELLED invoice's closing checkpoint,
    // or the device's earliest-ever TOTAL reading if this is its first
    // invoice — see data model note on the anchor query
    const anchor = await this.invoiceRepository.findOne({
      where: { deviceId: device.id, status: Not(InvoiceStatus.CANCELLED) },
      order: { billingPeriodEnd: 'DESC' },
    });

    let openingCheckpointId: string;
    let openingReading: string;
    let billingPeriodStart: string;

    if (anchor) {
      openingCheckpointId = anchor.closingCheckpointId;
      openingReading = anchor.closingReading;
      billingPeriodStart = anchor.billingPeriodEnd;
    } else {
      const earliest = await this.telemetryRepository.findOne({
        where: { deviceId: device.id, orgId, deviceTypeParamId: totalParamId },
        order: { deviceTimestamp: 'ASC' },
      });
      if (!earliest) {
        return { status: 'skipped', reason: 'no telemetry data recorded for this device yet' };
      }
      openingCheckpointId = earliest.id;
      openingReading = earliest.value;
      billingPeriodStart = this.formatDate(earliest.deviceTimestamp);
    }

    const closing = await this.telemetryRepository.findOne({
      where: {
        deviceId: device.id,
        orgId,
        deviceTypeParamId: totalParamId,
        deviceTimestamp: LessThanOrEqual(periodEnd),
      },
      order: { deviceTimestamp: 'DESC' },
    });

    if (!closing || closing.id === openingCheckpointId) {
      // no reading at all, or nothing newer than the opening checkpoint —
      // a real data gap, not a confirmed zero-consumption period; skip and
      // surface it rather than fabricate a $0 invoice from stale data
      return { status: 'skipped', reason: 'no new telemetry since the last invoice' };
    }

    const openingNum = Number(openingReading);
    const closingNum = Number(closing.value);
    const consumptionUnits = closingNum - openingNum;

    if (consumptionUnits < 0) {
      this.logger.warn(
        `Device ${device.id}: negative consumption (opening=${openingNum}, closing=${closingNum}) — possible meter reset/replacement, skipping`,
      );
      return { status: 'skipped', reason: 'negative consumption detected — needs manual review' };
    }

    const pricingConfig = await this.pricingConfigRepository.findOne({
      where: { deviceTypeId: device.deviceTypeId, orgId, effectiveTo: IsNull() },
      relations: { slabs: true },
    });
    if (!pricingConfig) {
      return { status: 'skipped', reason: 'no active pricing config for this device type' };
    }

    const { amount, appliedUnitRate } = this.computeAmount(consumptionUnits, pricingConfig);
    const billingPeriodEnd = this.formatDate(periodEnd);
    const dueDate = this.formatDate(new Date(periodEnd.getTime() + DUE_DAYS * 24 * 60 * 60 * 1000));

    await this.dataSource.transaction(async (manager) => {
      const invoice = manager.create(CustomerInvoice, {
        serialNo: `PENDING-${Date.now()}-${device.id}`,
        deviceId: device.id,
        billingPeriodStart,
        billingPeriodEnd,
        openingCheckpointId,
        closingCheckpointId: closing.id,
        openingReading,
        closingReading: closing.value,
        consumptionUnits: consumptionUnits.toFixed(4),
        pricingConfigId: pricingConfig.id,
        appliedUnitRate: appliedUnitRate.toFixed(4),
        amount: amount.toFixed(2),
        status: InvoiceStatus.PENDING,
        generatedAt: new Date(),
        dueDate,
        orgId,
      });
      const inserted = await manager.save(invoice);
      inserted.serialNo = `${orgId}-INV-${inserted.id.toString().padStart(6, '0')}`;
      await manager.save(inserted);
    });

    return { status: 'generated' };
  }

  // FIXED: amount = consumption * fixedRate. SLAB: walk tiers in order,
  // charging each unit of consumption at its tier's rate; appliedUnitRate
  // is the resulting blended rate — see the earlier design decision to
  // store a blended rate rather than a line-item-per-tier breakdown
  private computeAmount(
    consumptionUnits: number,
    config: PricingConfig,
  ): { amount: number; appliedUnitRate: number } {
    if (config.rateType === RateType.FIXED) {
      const rate = Number(config.fixedRate);
      return { amount: consumptionUnits * rate, appliedUnitRate: rate };
    }

    const sortedSlabs = [...config.slabs].sort((a, b) => Number(a.slabFrom) - Number(b.slabFrom));
    let remaining = consumptionUnits;
    let amount = 0;
    for (const slab of sortedSlabs) {
      const tierSize = slab.slabTo !== null ? Number(slab.slabTo) - Number(slab.slabFrom) : Infinity;
      const amountInTier = Math.min(remaining, tierSize);
      if (amountInTier <= 0) continue;
      amount += amountInTier * Number(slab.rate);
      remaining -= amountInTier;
      if (remaining <= 0) break;
    }

    const appliedUnitRate = consumptionUnits > 0 ? amount / consumptionUnits : 0;
    return { amount, appliedUnitRate };
  }

  private previousCalendarMonth(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)); // day 0 = last day of previous month
    return { start, end };
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private async getScopedEntity(id: number, orgId: string): Promise<CustomerInvoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id, orgId },
      relations: { device: { connection: true } },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    return invoice;
  }
}
