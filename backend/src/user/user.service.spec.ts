import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { Role, RoleType } from './entities/role.entity';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

function mockRepo() {
  return { findOne: jest.fn(), findAndCount: jest.fn(), create: jest.fn(), save: jest.fn(), softRemove: jest.fn() };
}

describe('UserService', () => {
  let service: UserService;
  let userRepository: ReturnType<typeof mockRepo>;
  let roleRepository: ReturnType<typeof mockRepo>;

  const currentUser: AuthenticatedUser = { userId: 1, orgId: 'ORG01', roleType: RoleType.ADMIN };

  const existingUser = {
    id: 2,
    firstName: 'Anjali',
    lastName: 'Deshpande',
    email: 'anjali.deshpande@gmail.com',
    phoneNumber: '9823456701',
    address: 'Flat 302, Sunrise Residency',
    pincode: '411004',
    isActive: true,
    orgId: 'ORG01',
    role: { type: RoleType.CUSTOMER },
  } as unknown as User;

  beforeEach(async () => {
    userRepository = mockRepo();
    roleRepository = mockRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Role), useValue: roleRepository },
      ],
    }).compile();
    service = module.get(UserService);
  });

  describe('create', () => {
    const createDto = {
      firstName: 'Rohan',
      lastName: 'Mehta',
      email: 'rohan.mehta@gmail.com',
      password: 'Customer@12345',
      phoneNumber: '9823456702',
      address: '12, Laxmi Nagar',
      pincode: '411038',
      roleType: RoleType.CUSTOMER,
    };

    it('rejects a duplicate email', async () => {
      userRepository.findOne.mockResolvedValue({ ...existingUser });
      await expect(service.create(createDto, currentUser)).rejects.toBeInstanceOf(ConflictException);
      expect(roleRepository.findOne).not.toHaveBeenCalled();
    });

    it('rejects when the org has no role configured for the requested roleType (setup bug, not client error)', async () => {
      userRepository.findOne.mockResolvedValue(null);
      roleRepository.findOne.mockResolvedValue(null);
      await expect(service.create(createDto, currentUser)).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('creates the user with a bcrypt password hash, never the plaintext password', async () => {
      userRepository.findOne.mockResolvedValue(null);
      roleRepository.findOne.mockResolvedValue({ id: 3, type: RoleType.CUSTOMER, orgId: 'ORG01' } as Role);
      userRepository.create.mockImplementation((data) => data);
      userRepository.save.mockImplementation((u) => Promise.resolve({ ...u, id: 10 }));

      const result = await service.create(createDto, currentUser);

      expect(result.id).toBe(10);
      expect(result.email).toBe('rohan.mehta@gmail.com');
      const savedUser = userRepository.save.mock.calls[0][0];
      expect(savedUser.passwordHash).not.toBe(createDto.password);
      expect(savedUser.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
      expect(savedUser.roleId).toBe(3);
      expect(savedUser.orgId).toBe('ORG01');
    });
  });

  // positive path
  describe('findOne', () => {
    it('returns the user when found within the caller\'s org', async () => {
      userRepository.findOne.mockResolvedValue({ ...existingUser });
      const result = await service.findOne(2, currentUser);
      expect(result.id).toBe(2);
      expect(result.email).toBe('anjali.deshpande@gmail.com');
    });
  });

  // negative paths — getScopedEntity is shared by findOne/update/remove, so
  // this covers all three. Org-scoping (a user existing, but in a different
  // org) is a distinct equivalence class from "doesn't exist at all": both
  // must 404 identically, since the WHERE clause filters by (id, orgId)
  // together — see UserService.getScopedEntity.
  describe('negative: not-found and org-scoping', () => {
    it('findOne 404s when no user matches the id', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, currentUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('findOne 404s for a user that exists but belongs to a different org (not just filtered out)', async () => {
      // the repository mock simulates the real WHERE (id, orgId) filter by
      // returning null when the orgId doesn't match — TypeORM would do the
      // same at the DB level, never returning another org's row at all
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(2, { ...currentUser, orgId: 'ORG99' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('update 404s when no user matches the id', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.update(999, { firstName: 'X' }, currentUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('remove 404s when no user matches the id', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.remove(999, currentUser)).rejects.toBeInstanceOf(NotFoundException);
      expect(userRepository.softRemove).not.toHaveBeenCalled();
    });
  });

  // positive path
  describe('remove', () => {
    it('soft-deletes (not a hard delete) — audit trail is preserved', async () => {
      const target = { ...existingUser };
      userRepository.findOne.mockResolvedValue(target);
      await service.remove(2, currentUser);
      expect(userRepository.softRemove).toHaveBeenCalledWith(target);
    });
  });

  // regression coverage for a real bug found during manual testing: update()
  // used to do Object.assign(user, dto), which nulled out every field the
  // caller didn't send (dto's declared-but-unsent fields exist as own
  // properties valued `undefined`, and Object.assign copies those too).
  // Fixed with explicit per-field `!== undefined` checks — this guards
  // against that regressing. See feedback_partial_update_bug memory.
  describe('update — partial update does not clobber untouched fields', () => {
    beforeEach(() => {
      userRepository.findOne.mockResolvedValue({ ...existingUser });
      userRepository.save.mockImplementation((u) => Promise.resolve(u));
    });

    it('leaves firstName/lastName/address/pincode untouched when only isActive is sent', async () => {
      const result = await service.update(2, { isActive: false }, currentUser);

      expect(result.isActive).toBe(false);
      expect(result.firstName).toBe('Anjali');
      expect(result.lastName).toBe('Deshpande');
      expect(result.address).toBe('Flat 302, Sunrise Residency');
      expect(result.pincode).toBe('411004');
    });

    it('leaves everything untouched except phoneNumber when only phoneNumber is sent', async () => {
      const result = await service.update(2, { phoneNumber: '9999999999' }, currentUser);

      expect(result.phoneNumber).toBe('9999999999');
      expect(result.firstName).toBe('Anjali');
      expect(result.isActive).toBe(true);
    });

    it('applies every field when a full update DTO is sent', async () => {
      const result = await service.update(
        2,
        {
          firstName: 'Anjali Updated',
          lastName: 'Deshpande Updated',
          phoneNumber: '9000000000',
          address: 'New Address',
          pincode: '400001',
          isActive: false,
        },
        currentUser,
      );

      expect(result.firstName).toBe('Anjali Updated');
      expect(result.lastName).toBe('Deshpande Updated');
      expect(result.phoneNumber).toBe('9000000000');
      expect(result.address).toBe('New Address');
      expect(result.pincode).toBe('400001');
      expect(result.isActive).toBe(false);
    });
  });
});
