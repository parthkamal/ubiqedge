import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ApiKeyGuard } from './api-key.guard';

function mockContext(headers: Record<string, string>, params: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers, params }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let pool: { query: jest.Mock };
  let guard: ApiKeyGuard;

  const REAL_KEY = 'a-very-real-org-api-key';
  const storedHashHex = createHash('sha256').update(REAL_KEY).digest('hex');

  beforeEach(() => {
    pool = { query: jest.fn() };
    guard = new ApiKeyGuard(pool as any);
  });

  it('rejects when the X-Api-Key header is missing', async () => {
    const ctx = mockContext({}, { orgCode: 'ORG01' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects when the org does not exist', async () => {
    pool.query.mockResolvedValue([[]]);
    const ctx = mockContext({ 'x-api-key': REAL_KEY }, { orgCode: 'UNKNOWN' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the org exists but has no API key configured yet (null hash)', async () => {
    pool.query.mockResolvedValue([[{ apiKeySecretHash: null }]]);
    const ctx = mockContext({ 'x-api-key': REAL_KEY }, { orgCode: 'ORG01' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a wrong key', async () => {
    pool.query.mockResolvedValue([[{ apiKeySecretHash: storedHashHex }]]);
    const ctx = mockContext({ 'x-api-key': 'totally-wrong-key' }, { orgCode: 'ORG01' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // boundary case: timingSafeEqual throws (not returns false) on
  // differently-sized buffers, so the length check must short-circuit
  // before it — a malformed/corrupted stored hash must not crash the guard
  it('rejects (not crash) when the stored hash is a different length than expected', async () => {
    pool.query.mockResolvedValue([[{ apiKeySecretHash: 'deadbeef' }]]); // 4 bytes, not a real sha256 (32 bytes)
    const ctx = mockContext({ 'x-api-key': REAL_KEY }, { orgCode: 'ORG01' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows the request through with the correct key', async () => {
    pool.query.mockResolvedValue([[{ apiKeySecretHash: storedHashHex }]]);
    const ctx = mockContext({ 'x-api-key': REAL_KEY }, { orgCode: 'ORG01' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('looks up the organization scoped to the :orgCode route param, not a client-trusted org id', async () => {
    pool.query.mockResolvedValue([[{ apiKeySecretHash: storedHashHex }]]);
    const ctx = mockContext({ 'x-api-key': REAL_KEY }, { orgCode: 'ORG01' });
    await guard.canActivate(ctx);
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['ORG01']);
  });
});
