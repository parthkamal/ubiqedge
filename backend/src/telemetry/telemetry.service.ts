import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { DeviceTelemetry } from './entities/device-telemetry.entity';
import { DeviceTypeParam } from '../device/entities/device-type-param.entity';
import { DeviceService } from '../device/device.service';
import { TelemetryQueryDto, TelemetryRangePreset } from './dto/telemetry-query.dto';
import { TelemetryReadingDto } from './dto/telemetry-reading.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PaginatedResult } from '../user/user.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_MS = 7 * DAY_MS; // legacy default when range is omitted entirely

const PRESET_WINDOW_MS: Partial<Record<TelemetryRangePreset, number>> = {
  [TelemetryRangePreset.DAY]: 1 * DAY_MS,
  [TelemetryRangePreset.WEEK]: 7 * DAY_MS,
  [TelemetryRangePreset.MONTH]: 30 * DAY_MS,
};

@Injectable()
export class TelemetryService {
  constructor(
    @InjectRepository(DeviceTelemetry)
    private readonly telemetryRepository: Repository<DeviceTelemetry>,
    @InjectRepository(DeviceTypeParam)
    private readonly deviceTypeParamRepository: Repository<DeviceTypeParam>,
    private readonly deviceService: DeviceService,
  ) {}

  async findForDevice(
    deviceId: number,
    query: TelemetryQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<TelemetryReadingDto>> {
    // reuses DeviceService's own org+ownership check (Admin, or the owning
    // Customer) rather than duplicating that rule here — throws 404 if this
    // device doesn't exist or isn't currentUser's to see
    const device = await this.deviceService.findOne(deviceId, currentUser);

    const { from, to } = this.resolveRange(query);
    if (from > to) {
      throw new BadRequestException('`from` must be before `to`');
    }

    const where: FindOptionsWhere<DeviceTelemetry> = {
      orgId: currentUser.orgId,
      deviceId,
      deviceTimestamp: Between(from, to),
    };

    if (query.paramKey) {
      const deviceTypeParam = await this.deviceTypeParamRepository.findOne({
        where: { paramKey: query.paramKey, orgId: currentUser.orgId },
        relations: { deviceType: true },
      });
      if (!deviceTypeParam || deviceTypeParam.deviceType.type !== device.type) {
        throw new BadRequestException(
          `paramKey ${query.paramKey} is not valid for a ${device.type} device`,
        );
      }
      where.deviceTypeParamId = deviceTypeParam.id;
    }

    // selection is newest-first — page 1 is "now, going backwards" — so a
    // range with more readings than `limit` keeps the most recent ones
    // instead of silently truncating to the oldest slice of the window.
    // The page itself is then reversed back to chronological order before
    // returning, since a line chart needs ascending order to render
    // left-to-right; only the *selection* direction is newest-first.
    const [rowsNewestFirst, total] = await this.telemetryRepository.findAndCount({
      // only the columns the response DTO actually uses (id is required by
      // TypeORM's own DISTINCT-pagination subquery when relations + skip/take
      // are combined — it's never exposed by TelemetryReadingDto.fromEntity)
      select: { id: true, value: true, deviceTimestamp: true, deviceTypeParam: { paramKey: true } },
      where,
      relations: { deviceTypeParam: true },
      order: { deviceTimestamp: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    const readings = rowsNewestFirst.reverse();

    return {
      data: readings.map((r) => TelemetryReadingDto.fromEntity(r)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  private resolveRange(query: TelemetryQueryDto): { from: Date; to: Date } {
    const now = new Date();

    if (query.range === TelemetryRangePreset.CUSTOM) {
      if (!query.from || !query.to) {
        throw new BadRequestException('from and to are both required when range=custom');
      }
      return { from: new Date(query.from), to: this.resolveInclusiveUpperBound(query.to) };
    }

    if (query.range) {
      const windowMs = PRESET_WINDOW_MS[query.range]!;
      return { from: new Date(now.getTime() - windowMs), to: now };
    }

    // no range given — legacy from/to-driven behavior, 7-day default
    const to = query.to ? this.resolveInclusiveUpperBound(query.to) : now;
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - DEFAULT_WINDOW_MS);
    return { from, to };
  }

  // a date-only string ("2026-08-11") parses to midnight UTC — correct as
  // an inclusive lower bound, but wrong as an inclusive upper bound since it
  // would exclude every reading actually on that day. Bump to end-of-day
  // only when the caller gave a bare date; a full datetime (with an
  // explicit time component) is respected as-is, since a precise time
  // window ("up to 3pm today") is a legitimate request this endpoint
  // supports and forcing it to day-end would silently widen it
  private resolveInclusiveUpperBound(value: string): Date {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date;
  }
}
