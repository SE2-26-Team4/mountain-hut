import { AuthContext } from './auth-context.js';

/**
 * @typedef {ReturnType<typeof import('../hooks/useAuthLogic.js').useAuthLogic>} AuthState
 */

/**
 * @param {Object} props
 * @param {AuthState} props.value
 * @param {import('react').ReactNode} props.children
 */
export function AuthProvider({ value, children }) {
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}