import { useState } from "react";
import { Form } from "react-bootstrap";

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
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {() => void} [props.onBlur]
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
  className = "mb-3",
  hint = "",
  error = "",
  onBlur,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Form.Group className={className} controlId={controlId}>
      <Form.Label>{label}</Form.Label>

      <div className="mh-auth-input-wrapper">
        <span className="mh-auth-input-icon" aria-hidden="true">
          <i className="bi bi-lock" />
        </span>

        <Form.Control
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          isInvalid={Boolean(error)}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? `${controlId}-feedback` : undefined}
          disabled={disabled}
          required
        />

        <button
          className="mh-auth-password-toggle"
          type="button"
          aria-label={`${showPassword ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={showPassword}
          disabled={disabled}
          onClick={() => setShowPassword((current) => !current)}
        >
          <i
            className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}
            aria-hidden="true"
          />
        </button>
      </div>
      {(hint || error) && (
        <Form.Text
          id={`${controlId}-feedback`}
          className={`d-block ${error ? "text-danger" : "text-muted"}`}
          aria-live="polite"
        >
          {error || hint}
        </Form.Text>
      )}
    </Form.Group>
  );
}
