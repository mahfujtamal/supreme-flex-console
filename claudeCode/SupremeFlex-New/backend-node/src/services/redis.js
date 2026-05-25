import Redis from 'ioredis';

let _client = null;

export function getRedis() {
  if (!_client) {
    _client = new Redis({
      host:                 process.env.REDIS_HOST || '127.0.0.1',
      port:                 parseInt(process.env.REDIS_PORT || '6379', 10),
      db:                   parseInt(process.env.REDIS_DB   || '0',   10),
      lazyConnect:          true,
      maxRetriesPerRequest: 0,
      enableOfflineQueue:   false,
    });
    _client.on('error', () => {}); // prevent unhandled-error crash; callers use .catch()
  }
  return _client;
}
