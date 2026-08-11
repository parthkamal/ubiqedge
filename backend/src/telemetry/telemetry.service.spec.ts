import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { DeviceTelemetry } from './entities/device-telemetry.entity';
import { DeviceTypeParam, ParamKey } from '../device/entities/device-type-param.entity';
import { DeviceService } from '../device/device.service';
import { DeviceTypeEnum } from '../device/entities/device-type.entity';
import { TelemetryRangePreset } from './dto/telemetry-query.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RoleType } from '../user/entities/role.entity';

function mockRepo() {
  return { findOne: jest.fn(), findAndCount: jest.fn() };
}

describe('TelemetryService', () => {
  let service: TelemetryService;
  let telemetryRepository: ReturnType<typeof mockRepo>;
  let deviceTypeParamRepository: ReturnType<typeof mockRepo>;
  let deviceService: { findOne: jest.Mock };

  const currentUser: AuthenticatedUser = { userId: 1, orgId: 'ORG01', roleType: RoleType.ADMIN };
  const meterDevice = { id: 10, type: DeviceTypeEnum.METER };

  beforeEach(async () => {
    telemetryRepository = mockRepo();
    deviceTypeParamRepository = mockRepo();
    deviceService = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        { provide: getRepositoryToken(DeviceTelemetry), useValue: telemetryRepository },
        { provide: getRepositoryToken(DeviceTypeParam), useValue: deviceTypeParamRepository },
        { provide: DeviceService, useValue: deviceService },
      ],
    }).compile();

    service = module.get(TelemetryService);
    deviceService.findOne.mockResolvedValue(meterDevice);
    telemetryRepository.findAndCount.mockResolvedValue([[], 0]);
  });

  it('delegates ownership/existence checks to DeviceService.findOne and propagates its rejection untouched', async () => {
    const notFound = new Error('device not found');
    deviceService.findOne.mockRejectedValue(notFound);
    await expect(service.findForDevice(10, { page: 1, limit: 100 }, currentUser)).rejects.toBe(notFound);
    expect(telemetryRepository.findAndCount).not.toHaveBeenCalled();
  });

  // boundary value analysis + regression coverage: a bare date string as an
  // inclusive upper bound must be bumped to end-of-day (23:59:59.999),
  // otherwise every reading on that calendar day is silently excluded —
  // this is the exact bug fixed earlier (see feedback_partial_update_bug).
  // A full datetime must NOT be bumped — that would silently widen a
  // precise time-window request.
  describe('resolveRange — inclusive upper bound (boundary value analysis)', () => {
    it.each([
      ['bare date string is bumped to 23:59:59.999 UTC', '2026-08-11', '2026-08-11T23:59:59.999Z'],
      ['full datetime is respected as-is, not bumped', '2026-08-11T15:00:00.000Z', '2026-08-11T15:00:00.000Z'],
    ])('%s', async (_desc, toInput, expectedToIso) => {
      await service.findForDevice(
        10,
        { range: TelemetryRangePreset.CUSTOM, from: '2026-08-01', to: toInput, page: 1, limit: 100 },
        currentUser,
      );
      const where = telemetryRepository.findAndCount.mock.calls[0][0].where;
      const [, to] = where.deviceTimestamp.value;
      expect((to as Date).toISOString()).toBe(expectedToIso);
    });
  });

  describe('resolveRange — preset windows', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-11T12:00:00.000Z'));
    });
    afterEach(() => jest.useRealTimers());

    // equivalence partitioning: each preset maps to a distinct fixed window
    it.each([
      [TelemetryRangePreset.DAY, '2026-08-10T12:00:00.000Z'],
      [TelemetryRangePreset.WEEK, '2026-08-04T12:00:00.000Z'],
      [TelemetryRangePreset.MONTH, '2026-07-12T12:00:00.000Z'],
    ])('range=%s resolves `from` relative to now', async (range, expectedFromIso) => {
      await service.findForDevice(10, { range, page: 1, limit: 100 }, currentUser);
      const where = telemetryRepository.findAndCount.mock.calls[0][0].where;
      const [from, to] = where.deviceTimestamp.value;
      expect((from as Date).toISOString()).toBe(expectedFromIso);
      expect((to as Date).toISOString()).toBe('2026-08-11T12:00:00.000Z');
    });

    it('defaults to a 7-day window ending now when no range/from/to is given at all', async () => {
      await service.findForDevice(10, { page: 1, limit: 100 }, currentUser);
      const where = telemetryRepository.findAndCount.mock.calls[0][0].where;
      const [from, to] = where.deviceTimestamp.value;
      expect((from as Date).toISOString()).toBe('2026-08-04T12:00:00.000Z');
      expect((to as Date).toISOString()).toBe('2026-08-11T12:00:00.000Z');
    });
  });

  describe('resolveRange — validation', () => {
    it('rejects range=custom without both from and to', async () => {
      await expect(
        service.findForDevice(10, { range: TelemetryRangePreset.CUSTOM, from: '2026-08-01', page: 1, limit: 100 }, currentUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when from is after to', async () => {
      await expect(
        service.findForDevice(
          10,
          { range: TelemetryRangePreset.CUSTOM, from: '2026-08-20', to: '2026-08-01', page: 1, limit: 100 },
          currentUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('paramKey validation', () => {
    it('rejects a paramKey that is not configured for the org at all', async () => {
      deviceTypeParamRepository.findOne.mockResolvedValue(null);
      await expect(
        service.findForDevice(10, { paramKey: ParamKey.LEVEL, page: 1, limit: 100 }, currentUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a paramKey that belongs to a different device type than this device', async () => {
      // LEVEL belongs to TANK, but this device is a METER
      deviceTypeParamRepository.findOne.mockResolvedValue({
        id: 99,
        paramKey: ParamKey.LEVEL,
        deviceType: { type: DeviceTypeEnum.TANK },
      });
      await expect(
        service.findForDevice(10, { paramKey: ParamKey.LEVEL, page: 1, limit: 100 }, currentUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a paramKey that matches the device\'s own type and filters by it', async () => {
      deviceTypeParamRepository.findOne.mockResolvedValue({
        id: 42,
        paramKey: ParamKey.TOTAL,
        deviceType: { type: DeviceTypeEnum.METER },
      });

      await service.findForDevice(10, { paramKey: ParamKey.TOTAL, page: 1, limit: 100 }, currentUser);

      const where = telemetryRepository.findAndCount.mock.calls[0][0].where;
      expect(where.deviceTypeParamId).toBe(42);
    });
  });
});
