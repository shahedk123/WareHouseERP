const db = require('../lib/db');

// Simple JWT-based auth (in production, integrate with Auth0, Supabase Auth, etc.)
// For MVP, just extract user from headers for now

async function authenticate(req, res, next) {
  try {
    // Try to get user from header
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Store in req.user for downstream routes
    req.user = {
      id: userId,
      role: userRole
    };

    next();
  } catch (err) {
    res.status(401).json({ error: 'Auth error' });
  }
}

// Authorize specific roles
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        required_roles: allowedRoles,
        user_role: req.user.role
      });
    }

    next();
  };
}

module.exports = { authenticate, authorize };
