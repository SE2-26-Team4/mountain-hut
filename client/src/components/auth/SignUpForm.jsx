import { useState } from "react";
import { Alert, Button, Col, Form, Row } from "react-bootstrap";

import API, { SessionApiError } from "../../API/session-api.js";
import MountainLogo from "../common/MountainLogo.jsx";
import PasswordField from "./PasswordField.jsx";

const INITIAL_VALUES = {
  fullName: "",
  email: "",
  phone: "",
  emergencyContact: "",
  notes: "",
  password: "",
  confirmPassword: "",
};

const MAX_PROFILE_TEXT_LENGTH = 500;

/** @typedef {keyof typeof INITIAL_VALUES} FieldName */
/** @typedef {Partial<Record<FieldName, string>>} FieldErrors */

const PROFILE_FIELDS = /** @type {const} */ ([
  {
    name: "fullName",
    label: "Full name",
    placeholder: "E.g. Alex Rossi",
    type: "text",
    autoComplete: "name",
    icon: "",
    hint: "",
    required: true,
  },
  {
    name: "email",
    label: "Email address",
    placeholder: "name@example.com",
    type: "email",
    autoComplete: "email",
    icon: "bi-envelope",
    hint: "",
    required: true,
  },
  {
    name: "phone",
    label: "Mobile number",
    placeholder: "E.g. 333 123 4567",
    type: "tel",
    autoComplete: "tel",
    icon: "bi-telephone",
    hint: "Country code, spaces and hyphens are optional.",
    required: true,
  },
  {
    name: "emergencyContact",
    label: "Emergency contact (optional)",
    placeholder: "E.g. Anna Rossi, +39 333 765 4321",
    type: "text",
    autoComplete: "off",
    icon: "",
    hint: "",
    required: false,
  },
  {
    name: "notes",
    label: "Notes (optional)",
    placeholder: "E.g. registered mountain guide",
    type: "textarea",
    autoComplete: "off",
    icon: "",
    hint: "",
    required: false,
  },
]);

/**
 * @param {typeof INITIAL_VALUES} values
 * @returns {FieldErrors}
 */
function validate(values) {
  /** @type {FieldErrors} */
  const errors = {};

  const fullName = values.fullName.trim();
  const email = values.email.trim();
  const phone = values.phone.trim();
  const normalizedPhone = phone.replace(/[\s().-]/g, "");
  const passwordLength = Array.from(values.password).length;

  if (!fullName) {
    errors.fullName = "Enter your full name.";
  } else if (fullName.length > 100) {
    errors.fullName = "Use 100 characters or fewer.";
  }

  if (!email) {
    errors.email = "Enter your email address.";
  } else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!phone) {
    errors.phone = "Enter your mobile number.";
  } else if (phone.length > 30 || !/^\+?\d{6,15}$/.test(normalizedPhone)) {
    errors.phone = "Enter 6 to 15 digits, optionally starting with +.";
  }

  if (values.emergencyContact.trim().length > MAX_PROFILE_TEXT_LENGTH) {
    errors.emergencyContact = "Use 500 characters or fewer.";
  }

  if (values.notes.trim().length > MAX_PROFILE_TEXT_LENGTH) {
    errors.notes = "Use 500 characters or fewer.";
  }

  if (passwordLength === 0) {
    errors.password = "Enter a password.";
  } else if (passwordLength < 15) {
    errors.password = "Use at least 15 characters.";
  } else if (passwordLength > 128) {
    errors.password = "Use 128 characters or fewer.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Enter your password again.";
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "The passwords do not match.";
  }

  return errors;
}

/**
 * @param {Object} props
 * @param {() => void} props.onBack
 * @param {(email: string) => void} props.onRegistered
 */
export default function SignUpForm({ onBack, onRegistered }) {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [touched, setTouched] = useState(
    /** @type {Partial<Record<FieldName, boolean>>} */ ({}),
  );
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState(
    /** @type {FieldErrors} */ ({}),
  );
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errors = validate(values);

  /** @param {FieldName} field */
  function visibleError(field) {
    if (serverErrors[field]) return serverErrors[field];
    if (submitted || touched[field]) return errors[field] || "";
    return "";
  }

  /** @param {FieldName} field */
  function markTouched(field) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  /**
   * @param {FieldName} field
   * @param {string} value
   */
  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));

    setServerErrors((current) => {
      const next = { ...current };
      delete next[field];

      if (field === "password") {
        delete next.confirmPassword;
      }

      return next;
    });

    setFormError("");
  }

  /** @param {import("react").SubmitEvent<HTMLFormElement>} event */
  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    setSubmitted(true);

    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      document.getElementById(`signup-${firstInvalid}`)?.focus();
      return;
    }

    setIsSubmitting(true);
    setServerErrors({});
    setFormError("");

    const email = values.email.trim().toLowerCase();
    const details = {
      fullName: values.fullName.trim(),
      email,
      phone: values.phone.trim(),
      emergencyContact: values.emergencyContact.trim(),
      notes: values.notes.trim(),
      password: values.password,
      confirmPassword: values.confirmPassword,
    };

    try {
      await API.registerHiker(details);
    } catch (error) {
      if (error instanceof SessionApiError) {
        let field = error.field;

        if (
          error.code === "EMAIL_ALREADY_REGISTERED" ||
          error.code === "INVALID_EMAIL"
        ) {
          field = "email";
        } else if (error.code === "INVALID_PHONE") {
          field = "phone";
        } else if (error.code === "INVALID_NAME") {
          field = "fullName";
        }

        if (field && Object.hasOwn(INITIAL_VALUES, field)) {
          setServerErrors({ [field]: error.message });
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError(
          "Could not reach Mountain Hut. Check your connection and try again.",
        );
      }

      return;
    } finally {
      setIsSubmitting(false);
    }

    onRegistered(email);
  }

  return (
    <div className="mh-auth-card">
      <div className="mh-auth-brand">
        <MountainLogo />
        <span>MOUNTAIN HUT</span>
      </div>

      <div className="mh-auth-heading">
        <h2 className="mh-auth-title">Create an account</h2>
      </div>

      {formError && (
        <Alert variant="danger" role="alert" className="mh-auth-alert">
          {formError}
        </Alert>
      )}

      <Form noValidate onSubmit={handleSubmit}>
        <Row className="gx-3 gy-2">
          {PROFILE_FIELDS.map((field) => {
            const { name, label, type, autoComplete, icon, hint, required } =
              field;
            const id = `signup-${name}`;
            const error = visibleError(name);
            const feedback = error || hint;
            const isNotes = name === "notes";

            return (
              <Col key={name} xs={12} md={isNotes ? 12 : 6}>
                <Form.Group controlId={id}>
                  <Form.Label>{label}</Form.Label>

                  <div className={icon ? "mh-signup-input" : undefined}>
                    {icon && (
                      <i
                        className={`bi ${icon} mh-signup-input__icon`}
                        aria-hidden="true"
                      />
                    )}

                    <Form.Control
                      as={isNotes ? "textarea" : "input"}
                      type={isNotes ? undefined : type}
                      name={name}
                      placeholder={field.placeholder}
                      autoComplete={autoComplete}
                      value={values[name]}
                      required={required}
                      disabled={isSubmitting}
                      isInvalid={Boolean(error)}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={feedback ? `${id}-feedback` : undefined}
                      onChange={(event) =>
                        updateField(name, event.target.value)
                      }
                      onBlur={() => markTouched(name)}
                    />
                  </div>

                  {feedback && (
                    <Form.Text
                      id={`${id}-feedback`}
                      className={`d-block ${error ? "text-danger" : "text-muted"}`}
                      aria-live="polite"
                    >
                      {feedback}
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
            );
          })}

          <Col xs={12} md={6}>
            <PasswordField
              controlId="signup-password"
              label="Password"
              autoComplete="new-password"
              value={values.password}
              onChange={(value) => updateField("password", value)}
              onBlur={() => markTouched("password")}
              hint="Use 15 to 128 characters. Spaces are allowed."
              error={visibleError("password")}
              disabled={isSubmitting}
              className="mb-0"
            />
          </Col>

          <Col xs={12} md={6}>
            <PasswordField
              controlId="signup-confirmPassword"
              label="Confirm password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={(value) => updateField("confirmPassword", value)}
              onBlur={() => markTouched("confirmPassword")}
              error={visibleError("confirmPassword")}
              disabled={isSubmitting}
              className="mb-0"
            />
          </Col>

          <Col xs={12} className="pt-3">
            <Button
              type="submit"
              className="mh-primary-button mh-auth-submit w-100 d-flex justify-content-center align-items-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
          </Col>
        </Row>
      </Form>

      <p className="mh-staff-login-prompt">
        Already have an account?{" "}
        <button
          type="button"
          className="mh-auth-link"
          onClick={onBack}
          disabled={isSubmitting}
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
