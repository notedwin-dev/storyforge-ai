const { verifyUser } = require('../services/supabase');

// Middleware to verify authentication
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid authentication token'
      });
    }

    const user = await verifyUser(authHeader);
    
    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided authentication token is invalid or expired'
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to verify authentication'
    });
  }
}

// Optional auth middleware - doesn't fail if no token provided
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const user = await verifyUser(authHeader);
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue without auth
  }
}

// Middleware to check if user owns resource
function requireOwnership(getUserIdFromParams) {
  return (req, res, next) => {
    const resourceUserId = getUserIdFromParams(req);
    const currentUserId = req.user?.id;

    if (!currentUserId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      });
    }

    if (resourceUserId !== currentUserId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access this resource'
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireOwnership
};
