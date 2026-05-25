import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/services/db.js', () => ({
  pool: {
    query: vi.fn(),
    getConnection: vi.fn(),
  },
  newId:   vi.fn(() => Buffer.alloc(16)),
  toBin:   vi.fn((s) => Buffer.from(s.replace(/-/g, ''), 'hex')),
  fromBin: vi.fn(),
}));

vi.mock('../../src/services/phpBridge.js', () => ({
  sendSms: vi.fn(),
}));

// Redis mock: SET NX always succeeds (treat every request as a new idempotency key)
vi.mock('../../src/services/redis.js', () => ({
  getRedis: () => ({ set: vi.fn().mockResolvedValue('OK'), get: vi.fn() }),
}));

import app from '../../src/app.js';
import { pool } from '../../src/services/db.js';
import { sendSms } from '../../src/services/phpBridge.js';

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

// ── Shared test UUIDs ────────────────────────────────────────────────────────
const ORDER_ID   = '01900000-0000-7000-8000-000000000001';
const ITEM_ID    = '01900000-0000-7000-8000-000000000002';
const PRODUCT_ID = '01900000-0000-7000-8000-000000000003';
const CUSTOMER_ID = '01900000-0000-7000-8000-000000000004';
const ANCHOR_ID   = '01900000-0000-7000-8000-000000000005';
const SERVICE_ID  = '01900000-0000-7000-8000-000000000006';

const SETUP_BODY = {
  customer_id: CUSTOMER_ID,
  anchor_id: ANCHOR_ID,
  active_service_id: SERVICE_ID,
  old_cpe_serial: 'OLD-001',
  new_cpe_serial: 'NEW-002',
  notes: 'Swapped on-site',
  customer_msisdn: '01700000000',
  sms_message: 'Your CPE has been replaced.',
};

function makeConn(overrides = {}) {
  return {
    beginTransaction: vi.fn().mockResolvedValue(),
    query:            vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
    commit:           vi.fn().mockResolvedValue(),
    rollback:         vi.fn().mockResolvedValue(),
    release:          vi.fn(),
    ...overrides,
  };
}

// ── GET /leads/:id/accessories ───────────────────────────────────────────────
describe('GET /api/field-execution/leads/:id/accessories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/field-execution/leads/${ORDER_ID}/accessories`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with accessory rows', async () => {
    pool.query.mockResolvedValueOnce([[
      { item_id: ITEM_ID, product_id: PRODUCT_ID, quantity: 2, unit_price_bdt: '500.00' },
    ]]);

    const res = await request(app)
      .get(`/api/field-execution/leads/${ORDER_ID}/accessories`)
      .set('Authorization', `Bearer ${validToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it('returns 500 when db throws', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .get(`/api/field-execution/leads/${ORDER_ID}/accessories`)
      .set('Authorization', `Bearer ${validToken()}`);

    expect(res.status).toBe(500);
  });
});

// ── POST /leads/:id/accessories ──────────────────────────────────────────────
describe('POST /api/field-execution/leads/:id/accessories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`/api/field-execution/leads/${ORDER_ID}/accessories`)
      .set('Idempotency-Key', 'test-idem-401-post-acc')
      .send({ product_id: PRODUCT_ID });
    expect(res.status).toBe(401);
  });

  it('returns 400 when product_id is missing', async () => {
    const res = await request(app)
      .post(`/api/field-execution/leads/${ORDER_ID}/accessories`)
      .set('Authorization', `Bearer ${validToken()}`)
      .set('Idempotency-Key', 'test-idem-400-post-acc')
      .send({ quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/product_id/);
  });

  it('returns 201 on successful insert', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .post(`/api/field-execution/leads/${ORDER_ID}/accessories`)
      .set('Authorization', `Bearer ${validToken()}`)
      .set('Idempotency-Key', 'test-idem-201-post-acc')
      .send({ product_id: PRODUCT_ID, quantity: 2, unit_price_bdt: 500 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Accessory added');
  });

  it('returns 500 when db throws', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post(`/api/field-execution/leads/${ORDER_ID}/accessories`)
      .set('Authorization', `Bearer ${validToken()}`)
      .set('Idempotency-Key', 'test-idem-500-post-acc')
      .send({ product_id: PRODUCT_ID });

    expect(res.status).toBe(500);
  });
});

// ── PATCH /leads/:id/accessories/:itemId ─────────────────────────────────────
describe('PATCH /api/field-execution/leads/:id/accessories/:itemId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch(`/api/field-execution/leads/${ORDER_ID}/accessories/${ITEM_ID}`)
      .set('Idempotency-Key', 'test-idem-401-patch-acc')
      .send({ quantity: 3 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when quantity is missing', async () => {
    const res = await request(app)
      .patch(`/api/field-execution/leads/${ORDER_ID}/accessories/${ITEM_ID}`)
      .set('Authorization', `Bearer ${validToken()}`)
      .set('Idempotency-Key', 'test-idem-400-patch-acc')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/quantity/);
  });

  it('returns 200 on successful update', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .patch(`/api/field-execution/leads/${ORDER_ID}/accessories/${ITEM_ID}`)
      .set('Authorization', `Bearer ${validToken()}`)
      .set('Idempotency-Key', 'test-idem-200-patch-acc')
      .send({ quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Accessory updated');
  });

  it('returns 500 when db throws', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .patch(`/api/field-execution/leads/${ORDER_ID}/accessories/${ITEM_ID}`)
      .set('Authorization', `Bearer ${validToken()}`)
      .set('Idempotency-Key', 'test-idem-500-patch-acc')
      .send({ quantity: 3 });

    expect(res.status).toBe(500);
  });
});

// ── DELETE /leads/:id/accessories/:itemId ────────────────────────────────────
describe('DELETE /api/field-execution/leads/:id/accessories/:itemId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .delete(`/api/field-execution/leads/${ORDER_ID}/accessories/${ITEM_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 on successful delete', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .delete(`/api/field-execution/leads/${ORDER_ID}/accessories/${ITEM_ID}`)
      .set('Authorization', `Bearer ${validToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Accessory removed');
  });

  it('returns 500 when db throws', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .delete(`/api/field-execution/leads/${ORDER_ID}/accessories/${ITEM_ID}`)
      .set('Authorization', `Bearer ${validToken()}`);

    expect(res.status).toBe(500);
  });
});

// ── POST /leads/:id/setup-complete ───────────────────────────────────────────
describe('POST /api/field-execution/leads/:id/setup-complete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`/api/field-execution/leads/${ORDER_ID}/setup-complete`)
      .set('Idempotency-Key', 'test-idem-401-setup')
      .send(SETUP_BODY);
    expect(res.status).toBe(401);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post(`/api/field-execution/leads/${ORDER_ID}/setup-complete`)
      .set('Authorization', `Bearer ${validToken()}`)
      .set('Idempotency-Key', 'test-idem-400-setup')
      .send({ customer_id: CUSTOMER_ID }); // missing anchor_id, service_id, msisdn, message

    expect(res.status).toBe(400);
  });

  it('returns 200 with sms_sent:true when transaction and SMS both succeed', async () => {
    pool.getConnection.mockResolvedValueOnce(makeConn());
    sendSms.mockResolvedValueOnce(true);

    const res = await request(app)
      .post(`/api/field-execution/leads/${ORDER_ID}/setup-complete`)
      .set('Authorization', `Bearer ${validToken()}`)
      .set('Idempotency-Key', 'test-idem-200-setup-sms-true')
      .send(SETUP_BODY);

    expect(res.status).toBe(200);
    expect(res.body.sms_sent).toBe(true);
  });

  it('returns 200 with sms_sent:false when SMS fails (order still committed)', async () => {
    pool.getConnection.mockResolvedValueOnce(makeConn());
    sendSms.mockResolvedValueOnce(false);

    const res = await request(app)
      .post(`/api/field-execution/leads/${ORDER_ID}/setup-complete`)
      .set('Authorization', `Bearer ${validToken()}`)
      .set('Idempotency-Key', 'test-idem-200-setup-sms-false')
      .send(SETUP_BODY);

    expect(res.status).toBe(200);
    expect(res.body.sms_sent).toBe(false);
  });

  it('returns 500 and rolls back when db transaction fails', async () => {
    const conn = makeConn({
      query: vi.fn()
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // cpe_order_history INSERT
        .mockRejectedValueOnce(new Error('Constraint violation')), // orders UPDATE
    });
    pool.getConnection.mockResolvedValueOnce(conn);

    const res = await request(app)
      .post(`/api/field-execution/leads/${ORDER_ID}/setup-complete`)
      .set('Authorization', `Bearer ${validToken()}`)
      .set('Idempotency-Key', 'test-idem-500-setup')
      .send(SETUP_BODY);

    expect(res.status).toBe(500);
    expect(conn.rollback).toHaveBeenCalledOnce();
    expect(sendSms).not.toHaveBeenCalled();
  });
});
