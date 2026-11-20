import { useState } from "react";
import { Col, Row } from "react-bootstrap";

import ForgotPasswordForm from "./ForgotPasswordForm.jsx";
import LoginForm from "./LoginForm.jsx";
import SignUpForm from "./SignUpForm.jsx";

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
 * @param {'login' | 'forgot-password' | 'sign-up'} [props.initialView]
 */
function LoginModal({
  isSubmitting,
  errorMessage,
  feedbackMessage,
  onLogin,
  onClose,
  initialView = "login",
}) {
  const [view, setView] = useState(initialView);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);

  const dialogLabels = {
    login: "Sign in to Mountain Hut",
    "forgot-password": "Reset your Mountain Hut password",
    "sign-up": "Create your Mountain Hut account",
  };

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
        className={
          view === "sign-up"
            ? "mh-login-dialog mh-login-dialog--signup"
            : "mh-login-dialog"
        }
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabels[view]}
      >
        <button
          className="mh-login-close"
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>

        <Row className="g-0 mh-login-dialog-row">
          {view !== "sign-up" && (
            <Col xs={12} md={7} className="mh-login-dialog-visual">
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

                  <span className="mh-login-dialog-rule" aria-hidden="true" />

                  <p className="mh-login-dialog-tagline text-white">
                    Sign in to check your reservations and enjoy a unique alpine
                    experience.
                  </p>
                </div>
              </div>
            </Col>
          )}

          <Col
            xs={12}
            md={view === "sign-up" ? 12 : 5}
            className={
              view === "sign-up"
                ? "mh-login-dialog-form"
                : "mh-login-dialog-form d-flex align-items-center"
            }
          >
            {view === "login" && (
              <LoginForm
                isSubmitting={isSubmitting}
                errorMessage={showRegistrationSuccess ? "" : errorMessage}
                feedbackMessage={feedbackMessage}
                initialEmail={registeredEmail}
                registrationMessage={
                  showRegistrationSuccess
                    ? "Account created. Sign in to continue."
                    : ""
                }
                onLogin={(credentials) => {
                  setShowRegistrationSuccess(false);
                  return onLogin(credentials);
                }}
                onForgotPassword={() => {
                  setShowRegistrationSuccess(false);
                  setView("forgot-password");
                }}
                onSignUp={() => {
                  setShowRegistrationSuccess(false);
                  setView("sign-up");
                }}
              />
            )}

            {view === "sign-up" && (
              <SignUpForm
                onBack={() => setView("login")}
                onRegistered={(email) => {
                  setRegisteredEmail(email);
                  setShowRegistrationSuccess(true);
                  setView("login");
                }}
              />
            )}

            {view === "forgot-password" && (
              <ForgotPasswordForm onBack={() => setView("login")} />
            )}
          </Col>
        </Row>
      </section>
    </div>
  );
}

export default LoginModal;
