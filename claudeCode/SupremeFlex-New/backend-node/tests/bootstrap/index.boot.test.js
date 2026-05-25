import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all side-effect imports so importing index.js never starts a real server
vi.mock('dotenv/config', () => ({}));
vi.mock('../../src/app.js', () => ({ default: {} }));
vi.mock('../../src/services/dashboardBroadcast.js', () => ({
  broadcastDashboard: vi.fn().mockResolvedValue({}),
}));
vi.mock('http', () => ({
  createServer: vi.fn(() => ({ listen: vi.fn() })),
}));
vi.mock('ws', () => ({
  WebSocketServer: vi.fn(() => ({ on: vi.fn() })),
}));
vi.mock('jsonwebtoken', () => ({
  default: { verify: vi.fn() },
}));

const VALID_BASE_ENV = {
  JWT_SECRET: 'test-secret',
  NODE_ENV: 'development',
  OTP_DEV_PEEK: 'false',
  GPSHOP_MOCK: 'false',
  LOCATION_CHANGE_API_MOCK: 'false',
  REAL_IP_API_MOCK: 'false',
  CUSTOMER_LIFECYCLE_MOCK: 'false',
};

beforeEach(() => {
  vi.resetModules(); // force re-execution of index.js top-level code each test
  vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function bootWith(overrides = {}) {
  const env = { ...VALID_BASE_ENV, ...overrides };
  for (const [k, v] of Object.entries(env)) {
    vi.stubEnv(k, v);
  }
  try {
    await import('../../src/index.js');
  } catch (e) {
    if (!e.message.includes('process.exit')) throw e;
  }
}

describe('index.js boot guards', () => {
  it('exits when JWT_SECRET is missing', async () => {
    await bootWith({ JWT_SECRET: '' });
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
  });

  it('starts normally in development with all flags safe', async () => {
    await bootWith({});
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('exits when OTP_DEV_PEEK is true in production', async () => {
    await bootWith({ NODE_ENV: 'production', OTP_DEV_PEEK: 'true' });
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('OTP_DEV_PEEK'));
  });

  it('does not exit when OTP_DEV_PEEK is true in development', async () => {
    await bootWith({ NODE_ENV: 'development', OTP_DEV_PEEK: 'true' });
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('exits when GPSHOP_MOCK is true in production', async () => {
    await bootWith({ NODE_ENV: 'production', GPSHOP_MOCK: 'true' });
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('GPSHOP_MOCK'));
  });

  it('exits when LOCATION_CHANGE_API_MOCK is true in production', async () => {
    await bootWith({ NODE_ENV: 'production', LOCATION_CHANGE_API_MOCK: 'true' });
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('LOCATION_CHANGE_API_MOCK'));
  });

  it('exits when REAL_IP_API_MOCK is true in production', async () => {
    await bootWith({ NODE_ENV: 'production', REAL_IP_API_MOCK: 'true' });
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('REAL_IP_API_MOCK'));
  });

  it('exits when CUSTOMER_LIFECYCLE_MOCK is true in production', async () => {
    await bootWith({ NODE_ENV: 'production', CUSTOMER_LIFECYCLE_MOCK: 'true' });
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('CUSTOMER_LIFECYCLE_MOCK'));
  });
});
