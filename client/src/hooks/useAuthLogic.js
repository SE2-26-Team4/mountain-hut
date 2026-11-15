import { useEffect, useState } from 'react';

import API, { SessionApiError } from '../API/session-api.js';

/**
 * @typedef {import('../API/session-api.js').SessionUser} SessionUser
 * @typedef {import('../API/session-api.js').LoginCredentials} LoginCredentials
 */

/**
 * @param {unknown} error
 * @returns {string}
 */
function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';
}

function useAuthLogic() {
  const [user, setUser] = useState(
    /** @type {SessionUser | null} */ (null),
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    API.getUserInfo()
      .then((currentUser) => {
        if (isMounted) {
          setUser(currentUser);
        }
      })
      .catch((error) => {
        if (!isMounted) return;

        if (error instanceof SessionApiError && error.status === 401) {
          return;
        }

        setErrorMessage(
          'We could not restore your session. Please try signing in.',
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * @param {LoginCredentials} credentials
   * @param {'hiker' | 'staff'} [area]
   * @returns {Promise<boolean>}
   */
  const handleLogin = async (credentials, area = 'hiker') => {
    setErrorMessage('');
    setFeedbackMessage('');
    setIsSubmitting(true);

    try {
      const authenticatedUser = await API.login(credentials, area);

      setUser(authenticatedUser);
      setFeedbackMessage('You are signed in.');

      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof SessionApiError && error.status === 401
          ? 'Email or password is incorrect. Please try again.'
          : getErrorMessage(error),
      );

      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  /** @returns {Promise<void>} */
  const handleLogout = async () => {
    setErrorMessage('');

    try {
      await API.logout();

      setUser(null);
      setFeedbackMessage('You have signed out successfully.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  /**
   * @param {{ currentPassword: string, newPassword: string, confirmPassword: string }} passwords
   * @returns {Promise<boolean>}
   */
  const handleChangePassword = async (passwords) => {
    setErrorMessage('');
    setFeedbackMessage('');
    setIsChangingPassword(true);

    try {
      const updatedUser = await API.changePassword(passwords);

      setUser(updatedUser);
      setFeedbackMessage('Your password has been updated.');

      return true;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));

      return false;
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSessionExpired = () => {
    setUser(null);
    setFeedbackMessage('');
    setErrorMessage('Your session has expired. Please sign in again.');
  };

  const clearFeedbackMessage = () => {
    setFeedbackMessage('');
  };

  return {
    user,
    isLoading,
    isSubmitting,
    isChangingPassword,
    errorMessage,
    feedbackMessage,
    clearFeedbackMessage,
    handleLogin,
    handleLogout,
    handleChangePassword,
    handleSessionExpired,
  };
}

export { useAuthLogic };