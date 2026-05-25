import crypto from 'crypto';
import { getRedis } from '../services/redis.js';

const TTL = 86400; // 24 hours

export function idempotency(req, res, next) {
  if (!['POST', 'PATCH', 'PUT'].includes(req.method)) return next();

  const key = req.headers['idempotency-key'];
  if (!key) return res.status(422).json({ message: 'Idempotency-Key header required' });

  const bodyHash = crypto.createHash('sha256')
    .update(JSON.stringify(req.body ?? ''))
    .digest('hex');

  const redisKey  = `idem:${key}`;
  const inFlight  = JSON.stringify({ status: 'in_flight', body_hash: bodyHash });
  const redis     = getRedis();

  redis.set(redisKey, inFlight, 'EX', TTL, 'NX')
    .then(result => {
      if (result !== null) {
        interceptAndCache(redis, redisKey, bodyHash, res, next);
        return;
      }

      return redis.get(redisKey).then(raw => {
        if (raw === null) {
          // Race: key evicted between SET NX and GET — treat as new
          return redis.set(redisKey, inFlight, 'EX', TTL)
            .then(() => interceptAndCache(redis, redisKey, bodyHash, res, next));
        }

        const stored = JSON.parse(raw);

        if (stored.status === 'in_flight') {
          return res.status(409).json({ message: 'Request with this Idempotency-Key is already in progress' });
        }

        if (stored.status === 'done') {
          if (stored.body_hash !== bodyHash) {
            return res.status(409).json({ message: 'Idempotency-Key reused with a different request body' });
          }
          return res
            .status(stored.status_code)
            .set('Content-Type', 'application/json')
            .set('X-Idempotency-Replayed', 'true')
            .end(stored.body);
        }
      });
    })
    .catch(() => {
      // Redis unavailable — fail open; request proceeds without idempotency protection
      interceptAndCache(null, redisKey, bodyHash, res, next);
    });
}

function interceptAndCache(redis, redisKey, bodyHash, res, next) {
  if (!redis) { next(); return; }

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const statusCode = res.statusCode;
    res.json = originalJson;

    redis.set(redisKey, JSON.stringify({
      status:      'done',
      body_hash:   bodyHash,
      status_code: statusCode,
      body:        JSON.stringify(body),
    }), 'EX', TTL).catch(() => {});

    return originalJson(body);
  };
  next();
}
