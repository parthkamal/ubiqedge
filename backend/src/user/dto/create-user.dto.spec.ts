import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { RoleType } from '../entities/role.entity';

// DTO validation is normally exercised end-to-end via the global
// ValidationPipe (see main.ts) — these tests call class-validator directly
// so the regex/length boundaries on phoneNumber/pincode/password (currently
// untested anywhere else) get explicit boundary-value coverage.
const validBase = {
  firstName: 'Anjali',
  email: 'anjali.deshpande@gmail.com',
  password: 'Customer@12345',
  phoneNumber: '9823456701',
  address: 'Flat 302, Sunrise Residency',
  pincode: '411004',
  roleType: RoleType.CUSTOMER,
};

async function fieldErrors(overrides: Partial<typeof validBase>) {
  const dto = plainToInstance(CreateUserDto, { ...validBase, ...overrides });
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('CreateUserDto validation', () => {
  it('has no errors for a fully valid payload', async () => {
    expect(await fieldErrors({})).toEqual([]);
  });

  // boundary value analysis: phoneNumber must be 7-15 digits
  describe('phoneNumber boundaries (/^[0-9]{7,15}$/)', () => {
    it.each([
      ['6 digits — one below the minimum', '123456', true],
      ['7 digits — minimum, valid', '1234567', false],
      ['15 digits — maximum, valid', '123456789012345', false],
      ['16 digits — one above the maximum', '1234567890123456', true],
    ])('%s -> %s', async (_desc, value, shouldError) => {
      const errors = await fieldErrors({ phoneNumber: value });
      expect(errors.includes('phoneNumber')).toBe(shouldError);
    });

    // equivalence partition: non-numeric input is a different failure
    // class from "wrong length" but must still be rejected
    it('rejects non-numeric characters', async () => {
      expect(await fieldErrors({ phoneNumber: '98234-5670' })).toContain('phoneNumber');
    });
  });

  // boundary value analysis: pincode must be 4-10 digits
  describe('pincode boundaries (/^[0-9]{4,10}$/)', () => {
    it.each([
      ['3 digits — one below the minimum', '123', true],
      ['4 digits — minimum, valid', '1234', false],
      ['10 digits — maximum, valid', '1234567890', false],
      ['11 digits — one above the maximum', '12345678901', true],
    ])('%s -> %s', async (_desc, value, shouldError) => {
      const errors = await fieldErrors({ pincode: value });
      expect(errors.includes('pincode')).toBe(shouldError);
    });
  });

  // boundary value analysis: password minimum length 8
  describe('password boundary (minLength 8)', () => {
    it.each([
      ['7 characters — one below the minimum', '1234567', true],
      ['8 characters — minimum, valid', '12345678', false],
    ])('%s -> %s', async (_desc, value, shouldError) => {
      const errors = await fieldErrors({ password: value });
      expect(errors.includes('password')).toBe(shouldError);
    });
  });

  // equivalence partitioning: email format classes
  describe('email format (equivalence partitioning)', () => {
    it.each([
      ['well-formed address', 'user@example.com', false],
      ['missing @', 'user.example.com', true],
      ['missing domain', 'user@', true],
      ['empty string', '', true],
    ])('%s -> %s', async (_desc, value, shouldError) => {
      const errors = await fieldErrors({ email: value });
      expect(errors.includes('email')).toBe(shouldError);
    });
  });

  // equivalence partitioning: roleType must be one of the enum's members
  describe('roleType (equivalence partitioning)', () => {
    it.each([
      ['Admin', false],
      ['Customer', false],
      ['SuperAdmin', true], // not a member of RoleType
    ])('%s -> %s', async (value, shouldError) => {
      const errors = await fieldErrors({ roleType: value as RoleType });
      expect(errors.includes('roleType')).toBe(shouldError);
    });
  });
});
