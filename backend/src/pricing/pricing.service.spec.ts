import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { PricingService } from './pricing.service';
import { PricingConfig, RateType } from './entities/pricing-config.entity';
import { DeviceType, DeviceTypeEnum } from '../device/entities/device-type.entity';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RoleType } from '../user/entities/role.entity';

function mockRepo() {
  return { find: jest.fn(), findOne: jest.fn(), findAndCount: jest.fn() };
}

describe('PricingService', () => {
  let service: PricingService;
  let configRepository: ReturnType<typeof mockRepo>;
  let deviceTypeRepository: ReturnType<typeof mockRepo>;
  let manager: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const currentUser: AuthenticatedUser = { userId: 1, orgId: 'ORG01', roleType: RoleType.ADMIN };
  const meterType: DeviceType = { id: 1, type: DeviceTypeEnum.METER, billed: true, orgId: 'ORG01' } as DeviceType;
  const tankType: DeviceType = { id: 2, type: DeviceTypeEnum.TANK, billed: false, orgId: 'ORG01' } as DeviceType;

  beforeEach(async () => {
    configRepository = mockRepo();
    deviceTypeRepository = mockRepo();
    manager = {
      findOne: jest.fn(),
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn((entityOrArray) =>
        Promise.resolve(
          Array.isArray(entityOrArray)
            ? entityOrArray.map((e, i) => ({ ...e, id: e.id ?? i + 1 }))
            : { ...entityOrArray, id: entityOrArray.id ?? 1 },
        ),
      ),
    };
    dataSource = { transaction: jest.fn((cb) => cb(manager)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: getRepositoryToken(PricingConfig), useValue: configRepository },
        { provide: getRepositoryToken(DeviceType), useValue: deviceTypeRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(PricingService);
  });

  describe('create — device type checks', () => {
    it('rejects an unknown device type', async () => {
      deviceTypeRepository.findOne.mockResolvedValue(null);
      await expect(
        service.create({ type: DeviceTypeEnum.METER, rateType: RateType.FIXED, fixedRate: 10 }, currentUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a device type that is not billed', async () => {
      deviceTypeRepository.findOne.mockResolvedValue(tankType);
      await expect(
        service.create({ type: DeviceTypeEnum.TANK, rateType: RateType.FIXED, fixedRate: 10 }, currentUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create — auto-close previous active config', () => {
    beforeEach(() => {
      deviceTypeRepository.findOne.mockResolvedValue(meterType);
    });

    it('closes the currently active config when creating a new one', async () => {
      const active = { id: 1, deviceTypeId: 1, effectiveTo: null } as unknown as PricingConfig;
      manager.findOne.mockResolvedValue(active);

      await service.create({ type: DeviceTypeEnum.METER, rateType: RateType.FIXED, fixedRate: 12 }, currentUser);

      // the active config was saved with effectiveTo set (auto-closed) before the new config's insert
      const closeCall = manager.save.mock.calls.find((call) => call[0] === active);
      expect(closeCall).toBeDefined();
      expect(closeCall![0].effectiveTo).toBeInstanceOf(Date);
    });

    it('does not attempt to close anything when no config is currently active', async () => {
      manager.findOne.mockResolvedValue(null);
      await service.create({ type: DeviceTypeEnum.METER, rateType: RateType.FIXED, fixedRate: 12 }, currentUser);
      // only the new config gets saved (1 save call), nothing else
      expect(manager.save).toHaveBeenCalledTimes(1);
    });
  });

  // equivalence partitioning: every distinct way a slab array can be
  // shaped, valid or invalid, per validateSlabStructure's four rules
  // (starts at 0 / contiguous / only-last-unbounded / slabTo > slabFrom).
  // Positive partitions assert acceptance; negative partitions assert the
  // specific rejection reason — each row is one equivalence class, not
  // just "another example".
  describe('create — SLAB structure validation (equivalence partitioning)', () => {
    beforeEach(() => {
      deviceTypeRepository.findOne.mockResolvedValue(meterType);
      manager.findOne.mockResolvedValue(null);
    });

    describe('positive: valid partitions are accepted', () => {
      it.each([
        [
          'multiple bounded tiers + one unbounded tail',
          [
            { slabFrom: 0, slabTo: 10, rate: 10 },
            { slabFrom: 10, slabTo: 20, rate: 15 },
            { slabFrom: 20, rate: 20 },
          ],
        ],
        ['single unbounded tier covering everything', [{ slabFrom: 0, rate: 10 }]],
        [
          'boundary: slabTo exactly one unit above slabFrom (smallest valid tier width)',
          [
            { slabFrom: 0, slabTo: 1, rate: 10 },
            { slabFrom: 1, rate: 20 },
          ],
        ],
      ])('%s', async (_description, slabs) => {
        await expect(
          service.create({ type: DeviceTypeEnum.METER, rateType: RateType.SLAB, slabs }, currentUser),
        ).resolves.toBeDefined();
      });
    });

    describe('negative: invalid partitions are rejected', () => {
      it.each([
        [
          'first slab does not start at 0',
          [
            { slabFrom: 5, slabTo: 10, rate: 10 },
            { slabFrom: 10, rate: 20 },
          ],
        ],
        [
          'gap between tiers',
          [
            { slabFrom: 0, slabTo: 10, rate: 10 },
            { slabFrom: 15, rate: 20 },
          ],
        ],
        [
          'overlap between tiers',
          [
            { slabFrom: 0, slabTo: 10, rate: 10 },
            { slabFrom: 5, rate: 20 },
          ],
        ],
        [
          'non-last slab omits slabTo',
          [
            { slabFrom: 0, rate: 10 },
            { slabFrom: 10, rate: 20 },
          ],
        ],
        [
          'last slab is bounded (must be unbounded)',
          [
            { slabFrom: 0, slabTo: 10, rate: 10 },
            { slabFrom: 10, slabTo: 20, rate: 20 },
          ],
        ],
        [
          'boundary: slabTo equal to slabFrom (zero-width tier)',
          [
            { slabFrom: 0, slabTo: 0, rate: 10 },
            { slabFrom: 0, rate: 20 },
          ],
        ],
        [
          'boundary: slabTo one unit below slabFrom',
          [
            { slabFrom: 0, slabTo: -1, rate: 10 },
            { slabFrom: -1, rate: 20 },
          ],
        ],
      ])('%s', async (_description, slabs) => {
        await expect(
          service.create({ type: DeviceTypeEnum.METER, rateType: RateType.SLAB, slabs }, currentUser),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });
  });

  describe('findAll', () => {
    it('lists every config for the org, active and superseded alike (no effectiveTo filter)', async () => {
      const active = { id: 2, deviceType: meterType, effectiveTo: null, slabs: [] } as unknown as PricingConfig;
      const superseded = {
        id: 1,
        deviceType: meterType,
        effectiveTo: new Date('2026-01-01'),
        slabs: [],
      } as unknown as PricingConfig;
      configRepository.findAndCount.mockResolvedValue([[active, superseded], 2]);

      const result = await service.findAll({ page: 1, limit: 20 }, currentUser);

      expect(configRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'ORG01' } }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by device type when provided', async () => {
      configRepository.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ page: 1, limit: 20, type: DeviceTypeEnum.METER }, currentUser);

      expect(configRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'ORG01', deviceType: { type: DeviceTypeEnum.METER } } }),
      );
    });
  });

  describe('findActive', () => {
    it('404s when the device type itself does not exist', async () => {
      deviceTypeRepository.findOne.mockResolvedValue(null);
      await expect(service.findActive({ type: DeviceTypeEnum.METER }, currentUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('404s when the device type exists but has no active config', async () => {
      deviceTypeRepository.findOne.mockResolvedValue(meterType);
      configRepository.findOne.mockResolvedValue(null);
      await expect(service.findActive({ type: DeviceTypeEnum.METER }, currentUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the active config (effectiveTo IS NULL) for the device type', async () => {
      deviceTypeRepository.findOne.mockResolvedValue(meterType);
      const active = {
        id: 5,
        deviceType: meterType,
        rateType: RateType.FIXED,
        fixedRate: '10.0000',
        effectiveTo: null,
        slabs: [],
      } as unknown as PricingConfig;
      configRepository.findOne.mockResolvedValue(active);

      const result = await service.findActive({ type: DeviceTypeEnum.METER }, currentUser);

      expect(configRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deviceTypeId: 1, effectiveTo: IsNull() }) }),
      );
      expect(result.id).toBe(5);
    });
  });
});
