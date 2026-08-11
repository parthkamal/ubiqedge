import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, In, QueryFailedError } from 'typeorm';
import { InvoiceService } from './invoice.service';
import { CustomerInvoice, InvoiceStatus } from './entities/customer-invoice.entity';
import { Device } from '../device/entities/device.entity';
import { DeviceTelemetry } from '../telemetry/entities/device-telemetry.entity';
import { DeviceTypeParam, ParamKey } from '../device/entities/device-type-param.entity';
import { PricingConfig, RateType } from '../pricing/entities/pricing-config.entity';
import { CustomerConnection } from '../account/entities/customer-connection.entity';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RoleType } from '../user/entities/role.entity';

// Mocks Repository/DataSource entirely — never touches a real DB. See
// feedback_nestjs_conventions memory: functional/integration testing is
// covered separately by manual verification against a live MySQL instance.
function mockRepo() {
  return { find: jest.fn(), findOne: jest.fn(), findAndCount: jest.fn(), save: jest.fn() };
}

describe('InvoiceService', () => {
  let service: InvoiceService;
  let invoiceRepository: ReturnType<typeof mockRepo>;
  let deviceRepository: ReturnType<typeof mockRepo>;
  let telemetryRepository: ReturnType<typeof mockRepo>;
  let deviceTypeParamRepository: ReturnType<typeof mockRepo>;
  let pricingConfigRepository: ReturnType<typeof mockRepo>;
  let connectionRepository: ReturnType<typeof mockRepo>;
  let manager: { create: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const currentUser: AuthenticatedUser = { userId: 1, orgId: 'ORG01', roleType: RoleType.ADMIN };

  const device: Device = {
    id: 10,
    deviceTypeId: 1,
    orgId: 'ORG01',
  } as Device;

  const totalParam: DeviceTypeParam = { id: 100, paramKey: ParamKey.TOTAL } as DeviceTypeParam;

  beforeEach(async () => {
    invoiceRepository = mockRepo();
    deviceRepository = mockRepo();
    telemetryRepository = mockRepo();
    deviceTypeParamRepository = mockRepo();
    pricingConfigRepository = mockRepo();
    connectionRepository = mockRepo();

    manager = {
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: entity.id ?? 999 })),
    };
    dataSource = { transaction: jest.fn((cb) => cb(manager)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: getRepositoryToken(CustomerInvoice), useValue: invoiceRepository },
        { provide: getRepositoryToken(Device), useValue: deviceRepository },
        { provide: getRepositoryToken(DeviceTelemetry), useValue: telemetryRepository },
        { provide: getRepositoryToken(DeviceTypeParam), useValue: deviceTypeParamRepository },
        { provide: getRepositoryToken(PricingConfig), useValue: pricingConfigRepository },
        { provide: getRepositoryToken(CustomerConnection), useValue: connectionRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(InvoiceService);
    deviceTypeParamRepository.findOne.mockResolvedValue(totalParam);
  });

  describe('generateForPeriod — request validation', () => {
    it('rejects billingPeriodStart without billingPeriodEnd', async () => {
      await expect(
        service.generateForPeriod({ billingPeriodStart: '2026-01-01' }, currentUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects start after end', async () => {
      await expect(
        service.generateForPeriod(
          { billingPeriodStart: '2026-02-01', billingPeriodEnd: '2026-01-01' },
          currentUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the org has no TOTAL telemetry param configured', async () => {
      deviceTypeParamRepository.findOne.mockResolvedValueOnce(null);
      await expect(
        service.generateForPeriod(
          { billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31' },
          currentUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns an empty result when there are no billed devices', async () => {
      deviceRepository.find.mockResolvedValue([]);
      const result = await service.generateForPeriod(
        { billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31' },
        currentUser,
      );
      expect(result.generated).toBe(0);
      expect(result.skipped).toEqual([]);
    });
  });

  describe('generateForPeriod — opening checkpoint anchoring', () => {
    beforeEach(() => {
      deviceRepository.find.mockResolvedValue([device]);
      pricingConfigRepository.findOne.mockResolvedValue({
        id: 5,
        rateType: RateType.FIXED,
        fixedRate: '10.0000',
        slabs: [],
      } as unknown as PricingConfig);
    });

    it('first invoice ever: anchors on the device earliest TOTAL reading', async () => {
      invoiceRepository.findOne.mockResolvedValue(null); // no prior invoice
      telemetryRepository.findOne
        .mockResolvedValueOnce({ id: '1', value: '100.0000', deviceTimestamp: new Date('2026-01-01') }) // earliest
        .mockResolvedValueOnce({ id: '2', value: '150.0000', deviceTimestamp: new Date('2026-01-31') }); // closing

      const result = await service.generateForPeriod(
        { billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31' },
        currentUser,
      );

      expect(result.generated).toBe(1);
      expect(result.skipped).toEqual([]);
      const savedInvoice = manager.save.mock.calls[0][0];
      expect(savedInvoice.openingCheckpointId).toBe('1');
      expect(savedInvoice.openingReading).toBe('100.0000');
      expect(savedInvoice.consumptionUnits).toBe('50.0000');
      expect(savedInvoice.amount).toBe('500.00'); // 50 units * 10/unit FIXED
    });

    it('subsequent invoice: anchors on the prior non-CANCELLED invoice closing checkpoint', async () => {
      invoiceRepository.findOne.mockResolvedValue({
        closingCheckpointId: '2',
        closingReading: '150.0000',
        billingPeriodEnd: '2026-01-31',
      } as CustomerInvoice);
      telemetryRepository.findOne.mockResolvedValueOnce({
        id: '3',
        value: '220.0000',
        deviceTimestamp: new Date('2026-02-28'),
      }); // only the closing lookup runs — no earliest-reading query needed when an anchor exists

      const result = await service.generateForPeriod(
        { billingPeriodStart: '2026-02-01', billingPeriodEnd: '2026-02-28' },
        currentUser,
      );

      expect(result.generated).toBe(1);
      const savedInvoice = manager.save.mock.calls[0][0];
      expect(savedInvoice.openingCheckpointId).toBe('2');
      expect(savedInvoice.openingReading).toBe('150.0000');
      expect(savedInvoice.billingPeriodStart).toBe('2026-01-31'); // = prior invoice's billingPeriodEnd
      expect(savedInvoice.consumptionUnits).toBe('70.0000');
    });

    it('skips when no telemetry has ever been recorded for the device', async () => {
      invoiceRepository.findOne.mockResolvedValue(null);
      telemetryRepository.findOne.mockResolvedValueOnce(null); // no earliest reading at all

      const result = await service.generateForPeriod(
        { billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31' },
        currentUser,
      );

      expect(result.generated).toBe(0);
      expect(result.skipped).toEqual([{ deviceId: 10, reason: 'no telemetry data recorded for this device yet' }]);
    });

    it('skips when there is no telemetry newer than the opening checkpoint (data gap)', async () => {
      invoiceRepository.findOne.mockResolvedValue({
        closingCheckpointId: '2',
        closingReading: '150.0000',
        billingPeriodEnd: '2026-01-31',
      } as CustomerInvoice);
      // closing lookup resolves to the SAME checkpoint as the opening one — no new reading
      telemetryRepository.findOne.mockResolvedValueOnce({
        id: '2',
        value: '150.0000',
        deviceTimestamp: new Date('2026-01-31'),
      });

      const result = await service.generateForPeriod(
        { billingPeriodStart: '2026-02-01', billingPeriodEnd: '2026-02-28' },
        currentUser,
      );

      expect(result.generated).toBe(0);
      expect(result.skipped).toEqual([{ deviceId: 10, reason: 'no new telemetry since the last invoice' }]);
    });

    it('skips on negative consumption (meter reset/replacement) rather than fabricating a bill', async () => {
      invoiceRepository.findOne.mockResolvedValue({
        closingCheckpointId: '2',
        closingReading: '500.0000',
        billingPeriodEnd: '2026-01-31',
      } as CustomerInvoice);
      telemetryRepository.findOne.mockResolvedValueOnce({
        id: '3',
        value: '10.0000', // lower than the opening reading — meter was reset
        deviceTimestamp: new Date('2026-02-28'),
      });

      const result = await service.generateForPeriod(
        { billingPeriodStart: '2026-02-01', billingPeriodEnd: '2026-02-28' },
        currentUser,
      );

      expect(result.generated).toBe(0);
      expect(result.skipped).toEqual([
        { deviceId: 10, reason: 'negative consumption detected — needs manual review' },
      ]);
    });

    it('skips when the device type has no active pricing config', async () => {
      invoiceRepository.findOne.mockResolvedValue(null);
      telemetryRepository.findOne
        .mockResolvedValueOnce({ id: '1', value: '100.0000', deviceTimestamp: new Date('2026-01-01') })
        .mockResolvedValueOnce({ id: '2', value: '150.0000', deviceTimestamp: new Date('2026-01-31') });
      pricingConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.generateForPeriod(
        { billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31' },
        currentUser,
      );

      expect(result.skipped).toEqual([{ deviceId: 10, reason: 'no active pricing config for this device type' }]);
    });
  });

  describe('generateForPeriod — SLAB pricing computation', () => {
    beforeEach(() => {
      deviceRepository.find.mockResolvedValue([device]);
      invoiceRepository.findOne.mockResolvedValue(null);
      pricingConfigRepository.findOne.mockResolvedValue({
        id: 7,
        rateType: RateType.SLAB,
        fixedRate: null,
        slabs: [
          { slabFrom: '0', slabTo: '10', rate: '10.0000' },
          { slabFrom: '10', slabTo: '20', rate: '15.0000' },
          { slabFrom: '20', slabTo: null, rate: '20.0000' },
        ],
      } as unknown as PricingConfig);
    });

    it('blends the rate across tiers for consumption spanning multiple slabs', async () => {
      telemetryRepository.findOne
        .mockResolvedValueOnce({ id: '1', value: '0.0000', deviceTimestamp: new Date('2026-01-01') })
        .mockResolvedValueOnce({ id: '2', value: '25.0000', deviceTimestamp: new Date('2026-01-31') });

      await service.generateForPeriod(
        { billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31' },
        currentUser,
      );

      // 10 units @10 + 10 units @15 + 5 units @20 = 100 + 150 + 100 = 350
      const savedInvoice = manager.save.mock.calls[0][0];
      expect(savedInvoice.consumptionUnits).toBe('25.0000');
      expect(savedInvoice.amount).toBe('350.00');
      expect(savedInvoice.appliedUnitRate).toBe('14.0000'); // 350 / 25
    });

    it('charges entirely within the first tier when consumption stays under its ceiling', async () => {
      telemetryRepository.findOne
        .mockResolvedValueOnce({ id: '1', value: '0.0000', deviceTimestamp: new Date('2026-01-01') })
        .mockResolvedValueOnce({ id: '2', value: '5.0000', deviceTimestamp: new Date('2026-01-31') });

      await service.generateForPeriod(
        { billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31' },
        currentUser,
      );

      const savedInvoice = manager.save.mock.calls[0][0];
      expect(savedInvoice.amount).toBe('50.00'); // 5 units @ 10/unit
      expect(savedInvoice.appliedUnitRate).toBe('10.0000');
    });

    // boundary value analysis on the tier-0-10 / tier-10-20 edge: the tier
    // walk uses `remaining <= 0` to stop, so consumption landing exactly ON
    // a boundary must stay entirely in the lower tier, and only spills into
    // the next tier just above it. Also covers the 0 lower boundary.
    describe('tier-boundary edge cases (boundary value analysis)', () => {
      it.each([
        ['exactly at the tier-1 ceiling (10) stays entirely in tier 1', '0.0000', '10.0000', '100.00', '10.0000'],
        ['just above the tier-1 ceiling (10.5) spills 0.5 units into tier 2', '0.0000', '10.5000', '107.50', '10.2381'],
        ['zero consumption (new reading, unchanged value) bills nothing', '5.0000', '5.0000', '0.00', '0.0000'],
      ])('%s', async (_description, openingValue, closingValue, expectedAmount, expectedRate) => {
        telemetryRepository.findOne
          .mockResolvedValueOnce({ id: '1', value: openingValue, deviceTimestamp: new Date('2026-01-01') })
          .mockResolvedValueOnce({ id: '2', value: closingValue, deviceTimestamp: new Date('2026-01-31') });

        await service.generateForPeriod(
          { billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31' },
          currentUser,
        );

        const savedInvoice = manager.save.mock.calls[0][0];
        expect(savedInvoice.amount).toBe(expectedAmount);
        expect(savedInvoice.appliedUnitRate).toBe(expectedRate);
      });
    });
  });

  describe('generateForPeriod — idempotency', () => {
    it('treats a duplicate-period unique-constraint violation as a safe skip, not a thrown error', async () => {
      deviceRepository.find.mockResolvedValue([device]);
      invoiceRepository.findOne.mockResolvedValue(null);
      telemetryRepository.findOne
        .mockResolvedValueOnce({ id: '1', value: '0.0000', deviceTimestamp: new Date('2026-01-01') })
        .mockResolvedValueOnce({ id: '2', value: '10.0000', deviceTimestamp: new Date('2026-01-31') });
      pricingConfigRepository.findOne.mockResolvedValue({
        id: 5,
        rateType: RateType.FIXED,
        fixedRate: '10.0000',
        slabs: [],
      } as unknown as PricingConfig);
      manager.save.mockRejectedValueOnce(
        new QueryFailedError('INSERT INTO customer_invoice ...', [], new Error('Duplicate entry') as any),
      );

      const result = await service.generateForPeriod(
        { billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31' },
        currentUser,
      );

      expect(result.generated).toBe(0);
      expect(result.skipped).toEqual([{ deviceId: 10, reason: 'already invoiced for this period' }]);
    });

    it('one device failing does not abort the batch for the remaining devices', async () => {
      const secondDevice = { ...device, id: 11 } as Device;
      deviceRepository.find.mockResolvedValue([device, secondDevice]);
      invoiceRepository.findOne.mockResolvedValue(null);
      telemetryRepository.findOne
        // device 10: no telemetry at all -> skipped
        .mockResolvedValueOnce(null)
        // device 11: valid readings -> generated
        .mockResolvedValueOnce({ id: '1', value: '0.0000', deviceTimestamp: new Date('2026-01-01') })
        .mockResolvedValueOnce({ id: '2', value: '10.0000', deviceTimestamp: new Date('2026-01-31') });
      pricingConfigRepository.findOne.mockResolvedValue({
        id: 5,
        rateType: RateType.FIXED,
        fixedRate: '10.0000',
        slabs: [],
      } as unknown as PricingConfig);

      const result = await service.generateForPeriod(
        { billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31' },
        currentUser,
      );

      expect(result.generated).toBe(1);
      expect(result.skipped).toEqual([{ deviceId: 10, reason: 'no telemetry data recorded for this device yet' }]);
    });
  });

  describe('cancel', () => {
    it('rejects cancelling an already-PAID invoice', async () => {
      invoiceRepository.findOne.mockResolvedValue({
        id: 1,
        status: InvoiceStatus.PAID,
        device: {},
      } as unknown as CustomerInvoice);

      await expect(service.cancel(1, currentUser)).rejects.toBeInstanceOf(BadRequestException);
      expect(invoiceRepository.save).not.toHaveBeenCalled();
    });

    it('marks a PENDING invoice CANCELLED', async () => {
      invoiceRepository.findOne.mockResolvedValue({
        id: 1,
        status: InvoiceStatus.PENDING,
        device: {},
      } as unknown as CustomerInvoice);
      invoiceRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.cancel(1, currentUser);
      expect(result.status).toBe(InvoiceStatus.CANCELLED);
    });
  });

  describe('generateForPeriod — defaults and unexpected errors', () => {
    it('defaults to the previous calendar month when no period is given', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-15T00:00:00Z'));
      deviceRepository.find.mockResolvedValue([]);

      const result = await service.generateForPeriod({}, currentUser);

      expect(result.billingPeriodStart).toBe('2026-02-01');
      expect(result.billingPeriodEnd).toBe('2026-02-28');
      jest.useRealTimers();
    });

    it('logs and skips (rather than aborting the batch) on an unexpected, non-idempotency error', async () => {
      deviceRepository.find.mockResolvedValue([device]);
      invoiceRepository.findOne.mockResolvedValue(null);
      telemetryRepository.findOne.mockRejectedValueOnce(new Error('connection reset'));

      const result = await service.generateForPeriod(
        { billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31' },
        currentUser,
      );

      expect(result.generated).toBe(0);
      expect(result.skipped).toEqual([{ deviceId: 10, reason: 'unexpected error — see server logs' }]);
    });
  });

  describe('findAll / findMine / findOne — read paths', () => {
    const invoiceEntity = {
      id: 1,
      serialNo: 'ORG01-INV-000001',
      status: InvoiceStatus.PENDING,
      device: { id: 10, name: 'Meter', serialNo: 'ORG01-METER-000010', connection: { userId: 5 } },
    } as unknown as CustomerInvoice;

    it('findAll scopes to the caller org and applies filters', async () => {
      invoiceRepository.findAndCount.mockResolvedValue([[invoiceEntity], 1]);
      const result = await service.findAll({ page: 1, limit: 20, status: InvoiceStatus.PENDING }, currentUser);
      expect(invoiceRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ orgId: 'ORG01', status: InvoiceStatus.PENDING }) }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('findMine returns empty (not an error) when the caller has no account yet', async () => {
      connectionRepository.findOne.mockResolvedValue(null);
      const result = await service.findMine({ page: 1, limit: 20 }, currentUser);
      expect(result).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
    });

    it('findMine returns empty when the account has no devices', async () => {
      connectionRepository.findOne.mockResolvedValue({ id: 1 } as CustomerConnection);
      deviceRepository.find.mockResolvedValue([]);
      const result = await service.findMine({ page: 1, limit: 20 }, currentUser);
      expect(result).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
    });

    it('findMine scopes invoices to the caller\'s own devices only', async () => {
      connectionRepository.findOne.mockResolvedValue({ id: 1 } as CustomerConnection);
      deviceRepository.find.mockResolvedValue([{ id: 10 }, { id: 11 }] as Device[]);
      invoiceRepository.findAndCount.mockResolvedValue([[invoiceEntity], 1]);

      await service.findMine({ page: 1, limit: 20 }, { ...currentUser, userId: 5, roleType: RoleType.CUSTOMER });

      expect(invoiceRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deviceId: In([10, 11]) }) }),
      );
    });

    it('findOne 404s for a Customer viewing an invoice they do not own', async () => {
      invoiceRepository.findOne.mockResolvedValue(invoiceEntity);
      await expect(
        service.findOne(1, { userId: 999, orgId: 'ORG01', roleType: RoleType.CUSTOMER }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('findOne allows a Customer viewing their own invoice', async () => {
      invoiceRepository.findOne.mockResolvedValue(invoiceEntity);
      const result = await service.findOne(1, { userId: 5, orgId: 'ORG01', roleType: RoleType.CUSTOMER });
      expect(result.id).toBe(1);
    });

    it('findOne 404s when the invoice does not exist', async () => {
      invoiceRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, currentUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
