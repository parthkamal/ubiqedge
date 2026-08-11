import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DeviceService } from './device.service';
import { Device } from './entities/device.entity';
import { DeviceType, DeviceTypeEnum } from './entities/device-type.entity';
import { CustomerConnection } from '../account/entities/customer-connection.entity';
import { RoleType } from '../user/entities/role.entity';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

function mockRepo() {
  return { find: jest.fn(), findOne: jest.fn(), findAndCount: jest.fn(), save: jest.fn(), softRemove: jest.fn() };
}

describe('DeviceService', () => {
  let service: DeviceService;
  let deviceRepository: ReturnType<typeof mockRepo>;
  let deviceTypeRepository: ReturnType<typeof mockRepo>;
  let connectionRepository: ReturnType<typeof mockRepo>;
  let manager: { create: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const currentUser: AuthenticatedUser = { userId: 1, orgId: 'ORG01', roleType: RoleType.ADMIN };
  const meterType = { id: 1, type: DeviceTypeEnum.METER, orgId: 'ORG01' } as DeviceType;

  beforeEach(async () => {
    deviceRepository = mockRepo();
    deviceTypeRepository = mockRepo();
    connectionRepository = mockRepo();
    manager = {
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? 1 })),
    };
    dataSource = { transaction: jest.fn((cb) => cb(manager)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceService,
        { provide: getRepositoryToken(Device), useValue: deviceRepository },
        { provide: getRepositoryToken(DeviceType), useValue: deviceTypeRepository },
        { provide: getRepositoryToken(CustomerConnection), useValue: connectionRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(DeviceService);
  });

  describe('create', () => {
    it('500s when the device type is not configured for the org (setup bug, not client error)', async () => {
      deviceTypeRepository.findOne.mockResolvedValue(null);
      await expect(
        service.create({ name: 'Meter 1', type: DeviceTypeEnum.METER }, currentUser),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('404s when connectionId is provided but no such account exists in the org', async () => {
      deviceTypeRepository.findOne.mockResolvedValue(meterType);
      connectionRepository.findOne.mockResolvedValue(null);
      await expect(
        service.create({ name: 'Meter 1', type: DeviceTypeEnum.METER, connectionId: 99 }, currentUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates unassigned (connectionId null) when connectionId is omitted', async () => {
      deviceTypeRepository.findOne.mockResolvedValue(meterType);
      deviceRepository.findOne.mockResolvedValue({
        id: 3,
        connectionId: null,
        deviceType: meterType,
        connection: null,
      } as unknown as Device);

      await service.create({ name: 'Meter 1', type: DeviceTypeEnum.METER }, currentUser);

      const insertedDevice = manager.save.mock.calls[0][0];
      expect(insertedDevice.connectionId).toBeNull();
      expect(connectionRepository.findOne).not.toHaveBeenCalled();
    });

    it('derives serialNo from the row\'s own auto-increment id (two-step insert)', async () => {
      deviceTypeRepository.findOne.mockResolvedValue(meterType);
      manager.save
        .mockImplementationOnce((e) => Promise.resolve({ ...e, id: 42 }))
        .mockImplementationOnce((e) => Promise.resolve(e));
      deviceRepository.findOne.mockResolvedValue({
        id: 42,
        serialNo: 'ORG01-METER-000042',
        deviceType: meterType,
        connection: null,
      } as unknown as Device);

      await service.create({ name: 'Meter 1', type: DeviceTypeEnum.METER }, currentUser);

      const secondSaveArg = manager.save.mock.calls[1][0];
      expect(secondSaveArg.serialNo).toBe('ORG01-METER-000042');
    });
  });

  describe('findAll — filter combinations', () => {
    beforeEach(() => {
      deviceRepository.findAndCount.mockResolvedValue([[], 0]);
    });

    it('scopes to the caller org with no filters', async () => {
      await service.findAll({ page: 1, limit: 20 }, currentUser);
      expect(deviceRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'ORG01' } }),
      );
    });

    it('applies the connectionId filter when given alone', async () => {
      await service.findAll({ page: 1, limit: 20, connectionId: 7 }, currentUser);
      expect(deviceRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'ORG01', connectionId: 7 } }),
      );
    });

    // decision table: unassigned=true is documented to take precedence over
    // an explicit connectionId if both are somehow sent together
    it('unassigned=true overrides an explicit connectionId', async () => {
      await service.findAll({ page: 1, limit: 20, connectionId: 7, unassigned: true }, currentUser);
      const calledWhere = deviceRepository.findAndCount.mock.calls[0][0].where;
      expect(calledWhere.connectionId).toEqual(expect.objectContaining({ type: 'isNull' }));
    });

    it('expands search into an OR across name/serialNo', async () => {
      await service.findAll({ page: 1, limit: 20, search: 'meter' }, currentUser);
      const calledWhere = deviceRepository.findAndCount.mock.calls[0][0].where;
      expect(Array.isArray(calledWhere)).toBe(true);
      expect(calledWhere).toHaveLength(2);
    });
  });

  describe('findMine', () => {
    it('returns an empty array (not an error) when the caller has no account yet', async () => {
      connectionRepository.findOne.mockResolvedValue(null);
      await expect(service.findMine(currentUser)).resolves.toEqual([]);
      expect(deviceRepository.find).not.toHaveBeenCalled();
    });

    it('returns devices scoped to the caller\'s own connection', async () => {
      connectionRepository.findOne.mockResolvedValue({ id: 3 } as CustomerConnection);
      deviceRepository.find.mockResolvedValue([]);
      await service.findMine(currentUser);
      expect(deviceRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { connectionId: 3, orgId: 'ORG01' } }),
      );
    });
  });

  // decision table: ownership rule for findOne, role x isOwner
  describe('findOne (decision table: role x isOwner)', () => {
    it.each([
      ['Admin', 'owner', RoleType.ADMIN, 5, 'allowed'],
      ['Admin', 'non-owner', RoleType.ADMIN, 999, 'allowed'], // Admin always allowed
      ['Customer', 'owner', RoleType.CUSTOMER, 5, 'allowed'],
      ['Customer', 'non-owner', RoleType.CUSTOMER, 999, 'denied'],
    ])('role=%s, %s -> %s', async (_role, _owner, roleType, connectionUserId, expected) => {
      deviceRepository.findOne.mockResolvedValue({
        id: 1,
        deviceType: meterType,
        connection: { userId: connectionUserId },
      } as unknown as Device);

      const outcome = service.findOne(1, { userId: 5, orgId: 'ORG01', roleType });
      if (expected === 'allowed') {
        await expect(outcome).resolves.toBeDefined();
      } else {
        await expect(outcome).rejects.toBeInstanceOf(NotFoundException);
      }
    });

    it('404s when the device does not exist', async () => {
      deviceRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, currentUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // regression coverage for a real bug found during manual testing: setting
  // only device.connectionId = null did not persist, because `connection`
  // (the relation, still loaded on the fetched entity) was re-derived by
  // TypeORM on save and silently overrode the scalar-only change. Fixed by
  // nulling both together. See feedback_partial_update_bug memory.
  describe('update — connection assign/unassign (regression)', () => {
    it('unassigning nulls both connectionId and the connection relation', async () => {
      const device = { id: 1, deviceType: meterType, connectionId: 5, connection: { id: 5 } } as unknown as Device;
      deviceRepository.findOne.mockResolvedValue(device);
      deviceRepository.save.mockImplementation((d) => Promise.resolve(d));

      await service.update(1, { connectionId: null }, currentUser);

      const savedDevice = deviceRepository.save.mock.calls[0][0];
      expect(savedDevice.connectionId).toBeNull();
      expect(savedDevice.connection).toBeNull();
    });

    it('reassigning sets both connectionId and the connection relation together', async () => {
      const device = { id: 1, deviceType: meterType, connectionId: null, connection: null } as unknown as Device;
      const newConnection = { id: 9 } as CustomerConnection;
      deviceRepository.findOne.mockResolvedValue(device);
      connectionRepository.findOne.mockResolvedValue(newConnection);
      deviceRepository.save.mockImplementation((d) => Promise.resolve(d));

      await service.update(1, { connectionId: 9 }, currentUser);

      const savedDevice = deviceRepository.save.mock.calls[0][0];
      expect(savedDevice.connectionId).toBe(9);
      expect(savedDevice.connection).toBe(newConnection);
    });

    it('404s when reassigning to an account that does not exist', async () => {
      deviceRepository.findOne.mockResolvedValue({ id: 1 } as Device);
      connectionRepository.findOne.mockResolvedValue(null);
      await expect(service.update(1, { connectionId: 99 }, currentUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('leaves connectionId untouched when omitted from the update', async () => {
      const device = {
        id: 1,
        deviceType: meterType,
        connectionId: 5,
        connection: { id: 5 },
        name: 'Old name',
      } as unknown as Device;
      deviceRepository.findOne.mockResolvedValue(device);
      deviceRepository.save.mockImplementation((d) => Promise.resolve(d));

      await service.update(1, { name: 'New name' }, currentUser);

      const savedDevice = deviceRepository.save.mock.calls[0][0];
      expect(savedDevice.connectionId).toBe(5);
      expect(savedDevice.name).toBe('New name');
    });
  });

  describe('remove', () => {
    it('404s when the device does not exist', async () => {
      deviceRepository.findOne.mockResolvedValue(null);
      await expect(service.remove(999, currentUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('soft-deletes (not a hard delete)', async () => {
      const device = { id: 1 } as Device;
      deviceRepository.findOne.mockResolvedValue(device);
      await service.remove(1, currentUser);
      expect(deviceRepository.softRemove).toHaveBeenCalledWith(device);
    });
  });
});
