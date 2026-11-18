import { useState } from 'react';
import { Col, Row } from 'react-bootstrap';

import ForgotPasswordForm from './ForgotPasswordForm.jsx';
import LoginForm from './LoginForm.jsx';

/**
 * @typedef {import('../../API/session-api.js').LoginCredentials} LoginCredentials
 */

/**
 * @param {Object} props
 * @param {boolean} props.isSubmitting
 * @param {string} props.errorMessage
 * @param {string} props.feedbackMessage
 * @param {(credentials: LoginCredentials) => Promise<boolean>} props.onLogin
 * @param {() => void} props.onClose
 * @param {'login' | 'forgot-password'} [props.initialView]
 */
function LoginModal({
  isSubmitting,
  errorMessage,
  feedbackMessage,
  onLogin,
  onClose,
  initialView = 'login',
}) {
  const [view, setView] = useState(initialView);

  return (
    <div
      className="mh-login-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="mh-login-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={
          view === 'login'
            ? 'Sign in to Mountain Hut'
            : 'Reset your Mountain Hut password'
        }
      >
        <button
          className="mh-login-close"
          type="button"
          aria-label="Close sign-in"
          onClick={onClose}
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>

        <Row className="g-0 mh-login-dialog-row">
          <Col
            xs={12}
            md={7}
            className="mh-login-dialog-visual"
          >
            <img
              src="/images/login-hero.png"
              alt="Mountain hut overlooking the Alps at sunset"
            />

            <div className="mh-login-dialog-caption d-flex flex-column align-items-start">
              <div className="mh-login-photo-message d-flex flex-column align-items-start">
                <h2>
                  Good food,
                  <br />
                  higher horizons.
                </h2>

                <span
                  className="mh-login-dialog-rule"
                  aria-hidden="true"
                />

                <p className="mh-login-dialog-tagline text-white">
                  Sign in to check your reservations
                  and enjoy a unique alpine experience.
                </p>
              </div>
            </div>
          </Col>

          <Col
            xs={12}
            md={5}
            className="mh-login-dialog-form d-flex align-items-center"
          >
            <div className="w-100">
              {view === 'login' ? (
                <LoginForm
                  isSubmitting={isSubmitting}
                  errorMessage={errorMessage}
                  feedbackMessage={feedbackMessage}
                  onLogin={onLogin}
                  onForgotPassword={() => setView('forgot-password')}
                />
              ) : (
                <ForgotPasswordForm onBack={() => setView('login')} />
              )}
            </div>
          </Col>
        </Row>
      </section>
    </div>
  );
}

export default LoginModal;