/**
 * Allows access only to authenticated users with an allowed role.
 *
 * @param {...Express.User['role']} allowedRoles
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Login is required.',
        },
      });
    }

    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Login is required.',
        },
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.',
        },
      });
    }

    return next();
  };
}

export const requireStaff = requireRole('employee', 'warden');

/**
 * Prevents hiker features until the initial password has been replaced.
 *
 * @type {import('express').RequestHandler}
 */
export function requirePasswordChanged(req, res, next) {
  if (req.user?.role === 'hiker' && req.user.mustChangePassword) {
    return res.status(403).json({
      error: {
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must change your password before continuing.',
      },
    });
  }

  return next();
}