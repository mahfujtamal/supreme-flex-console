import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';

const mockSet = vi.fn();
const mockGet = vi.fn();
vi.mock('../../src/services/redis.js', () => ({
  getRedis: () => ({ set: mockSet, get: mockGet }),
}));

import { idempotency } from '../../src/middleware/idempotency.js';

function makeApp(handler = (req, res) => res.status(201).json({ ok: true })) {
  const app = express();
  app.use(express.json());
  app.use(idempotency);
  app.post('/test', handler);
  app.patch('/test', handler);
  return app;
}

function bodyHash(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

beforeEach(() => {
  mockSet.mockReset();
  mockGet.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('idempotency middleware', () => {
  it('passes GET through without requiring Idempotency-Key', async () => {
    const app = express();
    app.use(express.json());
    app.use(idempotency);
    app.get('/test', (req, res) => res.json({ ok: true }));
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('returns 422 when Idempotency-Key header is missing on POST', async () => {
    const res = await request(makeApp()).post('/test').send({ data: 'x' });
    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Idempotency-Key header required');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('executes request and stores done payload on first call', async () => {
    mockSet.mockResolvedValueOnce('OK'); // SET NX succeeds
    mockSet.mockResolvedValueOnce('OK'); // store done payload

    const res = await request(makeApp())
      .post('/test')
      .set('Idempotency-Key', 'key-001')
      .send({ data: 'first' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });

    // second SET should store the done payload
    const doneCall = mockSet.mock.calls[1];
    const stored   = JSON.parse(doneCall[1]);
    expect(stored.status).toBe('done');
    expect(stored.status_code).toBe(201);
    expect(stored.body_hash).toBe(bodyHash({ data: 'first' }));
  });

  it('replays cached response on duplicate key + same body', async () => {
    const body   = { data: 'same' };
    const cached = JSON.stringify({
      status:      'done',
      body_hash:   bodyHash(body),
      status_code: 201,
      body:        JSON.stringify({ ok: true }),
    });

    mockSet.mockResolvedValueOnce(null); // SET NX fails — key exists
    mockGet.mockResolvedValueOnce(cached);

    const res = await request(makeApp())
      .post('/test')
      .set('Idempotency-Key', 'key-002')
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['x-idempotency-replayed']).toBe('true');
  });

  it('returns 409 on duplicate key + different body', async () => {
    const cached = JSON.stringify({
      status:      'done',
      body_hash:   bodyHash({ data: 'original' }),
      status_code: 201,
      body:        JSON.stringify({ ok: true }),
    });

    mockSet.mockResolvedValueOnce(null);
    mockGet.mockResolvedValueOnce(cached);

    const res = await request(makeApp())
      .post('/test')
      .set('Idempotency-Key', 'key-003')
      .send({ data: 'changed' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Idempotency-Key reused with a different request body');
  });

  it('returns 409 when key is in-flight', async () => {
    const cached = JSON.stringify({
      status:    'in_flight',
      body_hash: bodyHash({ data: 'flying' }),
    });

    mockSet.mockResolvedValueOnce(null);
    mockGet.mockResolvedValueOnce(cached);

    const res = await request(makeApp())
      .post('/test')
      .set('Idempotency-Key', 'key-004')
      .send({ data: 'flying' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Request with this Idempotency-Key is already in progress');
  });

  it('fails open (proceeds without caching) when Redis is unavailable', async () => {
    mockSet.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(makeApp())
      .post('/test')
      .set('Idempotency-Key', 'key-005')
      .send({ data: 'x' });

    expect(res.status).toBe(201);
  });

  it('sets idem: key prefix in Redis', async () => {
    mockSet.mockResolvedValue('OK');

    await request(makeApp())
      .post('/test')
      .set('Idempotency-Key', 'my-key')
      .send({});

    expect(mockSet.mock.calls[0][0]).toBe('idem:my-key');
  });

  it('also enforces idempotency on PATCH', async () => {
    const res = await request(makeApp())
      .patch('/test')
      .send({ data: 'x' });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Idempotency-Key header required');
  });
});
