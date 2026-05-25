import jwt from 'jsonwebtoken';
import { getRedis } from '../services/redis.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }

  if (!payload.jti) {
    req.authUser = payload;
    return next();
  }

  getRedis().get(`jwt_rev:${payload.jti}`)
    .then(revoked => {
      if (revoked) return res.status(401).json({ message: 'Token has been revoked' });
      req.authUser = payload;
      next();
    })
    .catch(() => {
      // Redis unavailable — fail open; JWT signature already verified
      req.authUser = payload;
      next();
    });
}

// Backward-compat alias for existing route imports
export { requireAuth as authMiddleware };
