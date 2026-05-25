import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test_jwt_secret_for_ci';

// Mock redis.js before importing auth.js
const mockGet = vi.fn();
vi.mock('../../src/services/redis.js', () => ({
  getRedis: () => ({ get: mockGet }),
}));

import { requireAuth } from '../../src/middleware/auth.js';

function makeToken(overrides = {}) {
  return jwt.sign(
    { sub: 'user-1', jti: 'jti-abc', staff_type: 'CS', ...overrides },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function mockReq(token) {
  return { headers: { authorization: `Bearer ${token}` } };
}

function mockRes() {
  const res = { _status: null, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json   = (body)  => { res._body  = body; return res; };
  return res;
}

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', JWT_SECRET);
  mockGet.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('requireAuth middleware', () => {
  it('returns 401 when Authorization header is missing', () => {
    const req = { headers: {} };
    const res = mockRes();
    requireAuth(req, res, vi.fn());
    expect(res._status).toBe(401);
  });

  it('returns 401 for an invalid token', () => {
    const req = mockReq('not-a-valid-token');
    const res = mockRes();
    requireAuth(req, res, vi.fn());
    expect(res._status).toBe(401);
  });

  it('returns 401 when jti is in the revocation list', async () => {
    mockGet.mockResolvedValue('1');
    const req = mockReq(makeToken({ jti: 'revoked-jti' }));
    const res = mockRes();
    const next = vi.fn();

    await new Promise(resolve => {
      res.json = (body) => { res._body = body; resolve(); return res; };
      requireAuth(req, res, () => { next(); resolve(); });
    });

    expect(mockGet).toHaveBeenCalledWith('jwt_rev:revoked-jti');
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets req.authUser when token is valid and not revoked', async () => {
    mockGet.mockResolvedValue(null);
    const req = mockReq(makeToken({ jti: 'valid-jti' }));
    const res = mockRes();
    const next = vi.fn();

    await new Promise(resolve => {
      requireAuth(req, res, () => { next(); resolve(); });
    });

    expect(mockGet).toHaveBeenCalledWith('jwt_rev:valid-jti');
    expect(next).toHaveBeenCalled();
    expect(req.authUser).toMatchObject({ sub: 'user-1', jti: 'valid-jti' });
  });

  it('fails open (calls next) when Redis is unavailable', async () => {
    mockGet.mockRejectedValue(new Error('ECONNREFUSED'));
    const req = mockReq(makeToken({ jti: 'jti-redis-down' }));
    const res = mockRes();
    const next = vi.fn();

    await new Promise(resolve => {
      requireAuth(req, res, () => { next(); resolve(); });
    });

    expect(next).toHaveBeenCalled();
  });

  it('skips Redis check and calls next() for token without jti', () => {
    const tokenWithoutJti = jwt.sign({ sub: 'user-1' }, JWT_SECRET, { expiresIn: '15m' });
    const req = mockReq(tokenWithoutJti);
    const res = mockRes();
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(mockGet).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
