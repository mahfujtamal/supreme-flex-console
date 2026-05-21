import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock db.js before importing app so the router never touches MySQL
vi.mock('../../src/services/db.js', () => ({
  pool: {
    query: vi.fn(),
    getConnection: vi.fn(),
  },
  newId:   vi.fn(),
  toBin:   vi.fn((s) => Buffer.from(s.replace(/-/g, ''), 'hex')),
  fromBin: vi.fn((b) => b.toString('hex')),
}));

import app from '../../src/app.js';
import { pool } from '../../src/services/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_ci';

function validToken() {
  return jwt.sign(
    { sub: '01900000-0000-7000-8000-000000000001' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

describe('GET /api/dashboard/gpfi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/dashboard/gpfi');
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct shape when authenticated', async () => {
    pool.query.mockResolvedValueOnce([[{
      staging: 10,
      field_staff: 5,
      delivered: 200,
    }]]);

    const res = await request(app)
      .get('/api/dashboard/gpfi')
      .set('Authorization', `Bearer ${validToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      staging:     expect.any(Number),
      field_staff: expect.any(Number),
      delivered:   expect.any(Number),
    });
  });

  it('returns 500 when db throws', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app)
      .get('/api/dashboard/gpfi')
      .set('Authorization', `Bearer ${validToken()}`);

    expect(res.status).toBe(500);
  });
});
