import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccountService } from './account.service';
import { CustomerConnection, ConnectionStatus } from './entities/customer-connection.entity';
import { User } from '../user/entities/user.entity';
import { RoleType } from '../user/entities/role.entity';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

function mockRepo() {
  return { find: jest.fn(), findOne: jest.fn(), findAndCount: jest.fn(), save: jest.fn() };
}

describe('AccountService', () => {
  let service: AccountService;
  let connectionRepository: ReturnType<typeof mockRepo>;
  let userRepository: ReturnType<typeof mockRepo>;
  let manager: { create: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const currentUser: AuthenticatedUser = { userId: 1, orgId: 'ORG01', roleType: RoleType.ADMIN };

  const customerUser = {
    id: 5,
    firstName: 'Anjali',
    orgId: 'ORG01',
    role: { type: RoleType.CUSTOMER },
  } as unknown as User;

  beforeEach(async () => {
    connectionRepository = mockRepo();
    userRepository = mockRepo();
    manager = {
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id ?? 1 })),
    };
    dataSource = { transaction: jest.fn((cb) => cb(manager)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: getRepositoryToken(CustomerConnection), useValue: connectionRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(AccountService);
  });

  describe('create', () => {
    it('404s when the target user does not exist in the org', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.create({ userId: 5 }, currentUser)).rejects.toBeInstanceOf(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    // equivalence partitioning: only Customer-role users may have an account
    it.each([
      [RoleType.ADMIN, true],
      [RoleType.CUSTOMER, false],
    ])('roleType=%s -> rejected=%s', async (roleType, shouldReject) => {
      userRepository.findOne.mockResolvedValue({ ...customerUser, role: { type: roleType } });
      connectionRepository.findOne.mockResolvedValue(null);

      const outcome = service.create({ userId: 5 }, currentUser);
      if (shouldReject) {
        await expect(outcome).rejects.toBeInstanceOf(BadRequestException);
      } else {
        await expect(outcome).resolves.toBeDefined();
      }
    });

    it('rejects a user who already has an account (1:1 enforcement)', async () => {
      userRepository.findOne.mockResolvedValue(customerUser);
      connectionRepository.findOne.mockResolvedValue({ id: 1, userId: 5 } as CustomerConnection);
      await expect(service.create({ userId: 5 }, currentUser)).rejects.toBeInstanceOf(ConflictException);
    });

    it('generates accountNo from the row\'s own auto-increment id via the two-step insert', async () => {
      userRepository.findOne.mockResolvedValue(customerUser);
      connectionRepository.findOne.mockResolvedValue(null);
      manager.save
        .mockImplementationOnce((e) => Promise.resolve({ ...e, id: 7 })) // first save: placeholder gets id=7
        .mockImplementationOnce((e) => Promise.resolve(e)); // second save: real accountNo persisted

      const result = await service.create({ userId: 5 }, currentUser);

      expect(result.accountNo).toBe('ORG01-000007');
      expect(manager.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAll', () => {
    it('scopes to the caller org and applies the exact userId filter', async () => {
      connectionRepository.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ page: 1, limit: 20, userId: 5 }, currentUser);
      expect(connectionRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'ORG01', userId: 5 } }),
      );
    });

    it('expands search into an OR across accountNo/firstName/lastName/email', async () => {
      connectionRepository.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ page: 1, limit: 20, search: 'anjali' }, currentUser);
      const calledWhere = connectionRepository.findAndCount.mock.calls[0][0].where;
      expect(Array.isArray(calledWhere)).toBe(true);
      expect(calledWhere).toHaveLength(4);
    });
  });

  describe('findOne / findMine — negative (shared getScopedEntity)', () => {
    it('findOne 404s when no account matches', async () => {
      connectionRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, currentUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('findMine 404s when the caller has no account yet', async () => {
      connectionRepository.findOne.mockResolvedValue(null);
      await expect(service.findMine(currentUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('404s when no account matches', async () => {
      connectionRepository.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus(999, { status: ConnectionStatus.SUSPENDED }, currentUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // equivalence partitioning: both status transitions are valid, symmetric operations
    it.each([
      [ConnectionStatus.ACTIVE, ConnectionStatus.SUSPENDED],
      [ConnectionStatus.SUSPENDED, ConnectionStatus.ACTIVE],
    ])('transitions from %s to %s', async (from, to) => {
      const connection = { id: 1, status: from, user: {} } as unknown as CustomerConnection;
      connectionRepository.findOne.mockResolvedValue(connection);
      connectionRepository.save.mockImplementation((c) => Promise.resolve(c));

      const result = await service.updateStatus(1, { status: to }, currentUser);
      expect(result.status).toBe(to);
    });
  });
});
