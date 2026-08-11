import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';
import { RoleType } from '../user/entities/role.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: { findOne: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  const CORRECT_PASSWORD = 'Customer@12345';
  let passwordHash: string;

  const activeUser = () =>
    ({
      id: 5,
      email: 'anjali.deshpande@gmail.com',
      isActive: true,
      passwordHash,
      orgId: 'ORG01',
      role: { type: RoleType.CUSTOMER },
    }) as unknown as User;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(CORRECT_PASSWORD, 10);
  });

  beforeEach(async () => {
    userRepository = { findOne: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // equivalence partitioning + a security property: three distinct failure
  // reasons (no such user, deactivated user, wrong password) must all be
  // externally indistinguishable — same exception, same message — so a
  // caller can never use the error to learn whether an email is registered.
  describe('login — rejection reasons are indistinguishable (equivalence partitioning)', () => {
    it.each([
      ['no user with that email', null],
      ['user exists but is deactivated', { ...activeUser(), isActive: false }],
    ])('%s -> generic "Invalid credentials"', async (_desc, mockUser) => {
      userRepository.findOne.mockResolvedValue(mockUser);
      await expect(service.login('anjali.deshpande@gmail.com', CORRECT_PASSWORD)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('wrong password -> generic "Invalid credentials"', async () => {
      userRepository.findOne.mockResolvedValue(activeUser());
      await expect(service.login('anjali.deshpande@gmail.com', 'wrong-password')).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('login — positive path', () => {
    it('issues a JWT with sub/orgId/roleType for a correct, active login', async () => {
      userRepository.findOne.mockResolvedValue(activeUser());

      const result = await service.login('anjali.deshpande@gmail.com', CORRECT_PASSWORD);

      expect(result).toEqual({ accessToken: 'signed.jwt.token' });
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 5, orgId: 'ORG01', roleType: RoleType.CUSTOMER });
    });

    it('looks up by email only — never trusts a client-supplied org scope', async () => {
      userRepository.findOne.mockResolvedValue(activeUser());
      await service.login('anjali.deshpande@gmail.com', CORRECT_PASSWORD);
      expect(userRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'anjali.deshpande@gmail.com' } }),
      );
    });
  });
});
