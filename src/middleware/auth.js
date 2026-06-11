import { verifyToken, extractTokenFromHeader } from '../utils/auth.js';
import { getUserById } from '../db/queries.js';

export function authMiddleware(req, res, next) {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const user = getUserById(decoded.userId);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: User not found' });
  }

  if (user.is_banned) {
    return res.status(403).json({ error: 'Forbidden: User is banned' });
  }

  req.user = user;
  next();
}

export function optionalAuthMiddleware(req, res, next) {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      const user = getUserById(decoded.userId);
      if (user && !user.is_banned) {
        req.user = user;
      }
    }
  }

  next();
}

export function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: No user' });
  }

  // For now, we'll check if user ID is in ADMIN_IDS env var
  const adminIds = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  
  if (!adminIds.includes(req.user.telegram_id)) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  next();
}

export function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
