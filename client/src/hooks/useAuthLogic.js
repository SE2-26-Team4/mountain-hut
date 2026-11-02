import { useState, useEffect } from 'react';

export function useAuthLogic() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function restoreSession() {
      try {
        const response = await fetch('/api/sessions/current', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        setError(err.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  const logout = async () => {
    try {
      const response = await fetch('/api/sessions/current', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok || response.status === 204) {
        setUser(null);
      } else {
        throw new Error('Logout failed on server');
      }
    } catch (err) {
      console.error('Error during logout:', err);
      throw err;
    }
  };

  return { user, setUser, loading, error, logout };
}