import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/services/db.js', () => ({
  pool: {
    query: vi.fn(),
    getConnection: vi.fn(),
  },
  newId:   vi.fn(),
  toBin:   vi.fn((s) => Buffer.from(s.replace(/-/g, ''), 'hex')),
  fromBin: vi.fn(),
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

describe('GET /api/field-execution/leads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/field-execution/leads');
    expect(res.status).toBe(401);
  });

  it('returns 200 with array when authenticated', async () => {
    pool.query.mockResolvedValueOnce([[
      { order_id: 'abc', order_status: 'PENDING', accessories: [] },
    ]]);

    const res = await request(app)
      .get('/api/field-execution/leads')
      .set('Authorization', `Bearer ${validToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 500 when db throws', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .get('/api/field-execution/leads')
      .set('Authorization', `Bearer ${validToken()}`);

    expect(res.status).toBe(500);
  });
});
