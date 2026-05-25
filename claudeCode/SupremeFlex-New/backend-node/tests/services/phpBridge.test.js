import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendSms } from '../../src/services/phpBridge.js';

describe('phpBridge.sendSms', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when PHP responds 200', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true });

    const result = await sendSms('01700000000', 'Your connection is active.');

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('/api/internal/sms');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      msisdn: '01700000000',
      message: 'Your connection is active.',
    });
  });

  it('sends X-Internal-Key header', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true });

    await sendSms('01700000000', 'Hello');

    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers).toHaveProperty('X-Internal-Key');
  });

  it('returns false when PHP responds with non-2xx', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 502 });

    const result = await sendSms('01700000000', 'Hello');

    expect(result).toBe(false);
  });

  it('returns false on network error without throwing', async () => {
    global.fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await sendSms('01700000000', 'Hello');

    expect(result).toBe(false);
  });
});
