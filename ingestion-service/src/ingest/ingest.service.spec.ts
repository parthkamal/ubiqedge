import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { IngestService } from './ingest.service';
import { MYSQL_POOL } from '../database/database.constants';
import { DeviceTypeEnum } from './device-type.enum';
import { ParamKey } from './param-key.enum';

// mocks the mysql2 pool entirely — no real DB, mirrors the backend's
// "mocked Repository/DataSource" convention for this TypeORM-free service
function mockPool() {
  return { query: jest.fn() };
}

describe('IngestService', () => {
  let service: IngestService;
  let pool: ReturnType<typeof mockPool>;

  const assignedDevice = { id: 100, deviceTypeId: 1, connectionId: 5, deviceType: DeviceTypeEnum.METER };
  const unassignedDevice = { id: 101, deviceTypeId: 1, connectionId: null, deviceType: DeviceTypeEnum.METER };

  const validDto = {
    deviceTimestamp: '2026-08-11T10:05:00.000Z',
    readings: [{ paramKey: ParamKey.TOTAL, value: 123.4 }],
  };

  beforeEach(async () => {
    pool = mockPool();
    const module: TestingModule = await Test.createTestingModule({
      providers: [IngestService, { provide: MYSQL_POOL, useValue: pool }],
    }).compile();
    service = module.get(IngestService);
  });

  describe('device resolution', () => {
    it('404s when no device matches the serialNo/org', async () => {
      pool.query.mockResolvedValueOnce([[]]); // findDevice: no rows
      await expect(
        service.ingest('ORG01', DeviceTypeEnum.METER, 'ORG01-METER-999999', validDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s when the serialNo resolves to a device of a different type (path/device mismatch)', async () => {
      const tankDevice = { ...assignedDevice, deviceType: DeviceTypeEnum.TANK };
      pool.query.mockResolvedValueOnce([[tankDevice]]);
      await expect(
        service.ingest('ORG01', DeviceTypeEnum.METER, 'ORG01-TANK-000001', validDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409s when the device exists but is not yet linked to a customer account', async () => {
      pool.query.mockResolvedValueOnce([[unassignedDevice]]);
      await expect(
        service.ingest('ORG01', DeviceTypeEnum.METER, 'ORG01-METER-000101', validDto),
      ).rejects.toBeInstanceOf(ConflictException);
      // never reaches paramKey resolution or an insert once rejected here
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('paramKey validation', () => {
    it('422s when a reading\'s paramKey is not configured for this device type', async () => {
      pool.query
        .mockResolvedValueOnce([[assignedDevice]]) // findDevice
        .mockResolvedValueOnce([[]]); // resolveDeviceTypeParamId: no match

      await expect(
        service.ingest('ORG01', DeviceTypeEnum.METER, 'ORG01-METER-000100', validDto),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('resolves every paramKey before writing anything — one bad key among several blocks all inserts', async () => {
      const dto = {
        deviceTimestamp: '2026-08-11T10:05:00.000Z',
        readings: [
          { paramKey: ParamKey.TOTAL, value: 1 },
          { paramKey: ParamKey.FLOW, value: 2 },
        ],
      };
      pool.query
        .mockResolvedValueOnce([[assignedDevice]]) // findDevice
        .mockResolvedValueOnce([[{ id: 1 }]]) // TOTAL resolves fine
        .mockResolvedValueOnce([[]]); // FLOW does not -> 422

      await expect(
        service.ingest('ORG01', DeviceTypeEnum.METER, 'ORG01-METER-000100', dto),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      // exactly 3 calls (find device + 2 param resolutions) — no INSERT was
      // ever attempted, confirming validate-before-write ordering
      expect(pool.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('idempotent writes', () => {
    it('swallows a duplicate-key error (ER_DUP_ENTRY) instead of throwing — retried delivery is a safe no-op', async () => {
      pool.query
        .mockResolvedValueOnce([[assignedDevice]]) // findDevice
        .mockResolvedValueOnce([[{ id: 1 }]]) // resolveDeviceTypeParamId
        .mockRejectedValueOnce(Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' })); // insert

      await expect(
        service.ingest('ORG01', DeviceTypeEnum.METER, 'ORG01-METER-000100', validDto),
      ).resolves.toBeUndefined();
    });

    // equivalence partitioning: a genuine DB error is a distinct failure
    // class from the expected/absorbed duplicate-key case, and must not be
    // silently swallowed the same way
    it('rethrows a non-duplicate-key error rather than silently absorbing it', async () => {
      pool.query
        .mockResolvedValueOnce([[assignedDevice]])
        .mockResolvedValueOnce([[{ id: 1 }]])
        .mockRejectedValueOnce(Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }));

      await expect(
        service.ingest('ORG01', DeviceTypeEnum.METER, 'ORG01-METER-000100', validDto),
      ).rejects.toThrow('connection reset');
    });
  });

  describe('happy path', () => {
    it('inserts one row per reading, converting deviceTimestamp to a Date (mysql2 datetime requirement)', async () => {
      const dto = {
        deviceTimestamp: '2026-08-11T10:05:00.000Z',
        readings: [
          { paramKey: ParamKey.TOTAL, value: 100 },
          { paramKey: ParamKey.FLOW, value: 2.5 },
        ],
      };
      pool.query
        .mockResolvedValueOnce([[assignedDevice]]) // findDevice
        .mockResolvedValueOnce([[{ id: 11 }]]) // TOTAL param id
        .mockResolvedValueOnce([[{ id: 12 }]]) // FLOW param id
        .mockResolvedValueOnce([{}]) // insert TOTAL reading
        .mockResolvedValueOnce([{}]); // insert FLOW reading

      await service.ingest('ORG01', DeviceTypeEnum.METER, 'ORG01-METER-000100', dto);

      expect(pool.query).toHaveBeenCalledTimes(5);
      const [totalInsertSql, totalInsertParams] = pool.query.mock.calls[3];
      expect(totalInsertSql).toMatch(/INSERT INTO device_telemetry/);
      expect(totalInsertParams[0]).toBe(assignedDevice.id);
      expect(totalInsertParams[2]).toBe(11); // deviceTypeParamId for TOTAL
      expect(totalInsertParams[3]).toBe(100); // value
      expect(totalInsertParams[4]).toBeInstanceOf(Date);
      expect((totalInsertParams[4] as Date).toISOString()).toBe('2026-08-11T10:05:00.000Z');
    });
  });
});
