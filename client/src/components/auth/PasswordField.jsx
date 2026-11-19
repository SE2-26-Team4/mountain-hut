import { useState } from 'react';
import { Form } from 'react-bootstrap';

/**
 * Password input with the lock icon and the show/hide button of the
 * sign-in form.
 *
 * @param {Object} props
 * @param {string} props.controlId
 * @param {string} props.label
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {'current-password' | 'new-password'} props.autoComplete
 * @param {string} [props.placeholder]
 * @param {number} [props.minLength]
 * @param {number} [props.maxLength]
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 */
export default function PasswordField({
  controlId,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
  maxLength,
  disabled = false,
  className = 'mb-3',
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Form.Group className={className} controlId={controlId}>
      <Form.Label>{label}</Form.Label>

      <div className="mh-auth-input-wrapper">
        <span className="mh-auth-input-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="10" width="14" height="11" rx="2" />

            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>

        <Form.Control
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          required
        />

        <button
          className="mh-auth-password-toggle"
          type="button"
          aria-label={`${showPassword ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={showPassword}
          disabled={disabled}
          onClick={() => setShowPassword((current) => !current)}
        >
          <i
            className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </Form.Group>
  );
}
