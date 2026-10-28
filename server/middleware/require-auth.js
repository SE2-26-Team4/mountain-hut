// [Minimal login setup (backend)]: Require an authenticated user for protected routes.
export function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({
    error: {
      code: 'UNAUTHENTICATED',
      message: 'Login is required.',
    },
  });
}
