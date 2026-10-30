// [Employee access for capacity management]: Allow protected routes only to authenticated users with an allowed role.
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

    if (!allowedRoles.includes(req.user?.role)) {
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