import { createContext, useContext } from 'react';

/**
 * @typedef {ReturnType<typeof import('../hooks/useAuthLogic.js').useAuthLogic>} AuthState
 */

export const AuthContext = createContext(
  /** @type {AuthState | null} */ (null),
);

/**
 * @returns {AuthState}
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}