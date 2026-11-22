import { useRef, useState } from "react";
import { Alert, Form, Modal, Spinner } from "react-bootstrap";

import SuccessCheck from "../common/SuccessCheck.jsx";
import BookingAPI, { BookingApiError } from "../../API/booking-api.js";
import { readEmergencyContact } from "../../utils/emergency-contact.js";
import EmergencyContactFields from "../common/EmergencyContactFields.jsx";

// Limits enforced by the staff hiker API.
const MAX_TEXT_LENGTH = 500;

const emptyDraft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  notes: "",
  contactName: "",
  contactPhone: "",
};

/**
 * Checks a mobile number as the API does: 6-15 digits, optional leading +,
 * ignoring spaces, dashes, dots and brackets.
 *
 * @param {string} phone
 */
function isValidPhone(phone) {
  return /^\+?\d{6,15}$/.test(phone.replace(/[\s\-().]/g, ""));
}

/** @typedef {keyof typeof emptyDraft} HikerField */

/** @param {typeof emptyDraft} draft */
function validateDraft(draft) {
  /** @type {Partial<Record<HikerField, string>>} */
  const errors = {};
  const firstName = draft.firstName.trim();
  const lastName = draft.lastName.trim();
  const email = draft.email.trim();
  const phone = draft.phone.trim();

  if (!firstName) errors.firstName = "Enter the hiker's first name.";
  if (!lastName) errors.lastName = "Enter the hiker's last name.";

  if (firstName && lastName && `${firstName} ${lastName}`.length > 100) {
    errors.lastName = "Use 100 characters or fewer for the hiker's full name.";
  }

  if (!email) {
    errors.email = "Enter the hiker's email address.";
  } else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!phone) {
    errors.phone = "Enter the hiker's mobile number.";
  } else if (phone.length > 30 || !isValidPhone(phone)) {
    errors.phone = "Enter 6 to 15 digits, optionally starting with +.";
  }

  if (draft.notes.trim().length > MAX_TEXT_LENGTH) {
    errors.notes = "Use 500 characters or fewer.";
  }

  return Object.assign(errors, readEmergencyContact(draft).errors);
}

/**
 * @typedef {Object} RegistrationResult
 * @property {import("../../models/models.js").HikerDTO} hiker
 * @property {boolean} passwordSent
 */

/**
 * @param {{
 *   show: boolean,
 *   onHide: () => void,
 *   registration?: RegistrationResult | null,
 *   onRegister: (hiker: Exclude<import("../../models/models.js").StaffHikerInputDTO, { type: 'existing' }>) => Promise<void>,
 *   onContinue?: (hiker: RegistrationResult["hiker"]) => void,
 * }} props
 */
export default function NewHikerModal({
  show,
  onHide,
  registration = null,
  onRegister,
  onContinue,
}) {
  const [newHikerDraft, setNewHikerDraft] = useState(emptyDraft);
  const firstNameRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [touched, setTouched] = useState(
    /** @type {Partial<Record<HikerField, boolean>>} */ ({}),
  );
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");

  const errors = validateDraft(newHikerDraft);

  /** @param {HikerField} field */
  function markTouched(field) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  /** @param {HikerField} field */
  function visibleError(field) {
    if (field === "email" && emailError) return emailError;
    return submitted || touched[field] ? errors[field] || "" : "";
  }

  /** @param {HikerField} field */
  function validationProps(field) {
    const message = visibleError(field);
    return {
      onBlur: () => markTouched(field),
      isInvalid: Boolean(message),
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? `staff-error-${field}` : undefined,
    };
  }

  /** @param {HikerField} field */
  function feedback(field) {
    const message = visibleError(field);
    return message ? (
      <Form.Control.Feedback type="invalid" id={`staff-error-${field}`}>
        {message}
      </Form.Control.Feedback>
    ) : null;
  }

  const [resendStatus, setResendStatus] = useState(
    /** @type {"idle" | "sending" | "sent" | "failed" | "unavailable"} */ (
      "idle"
    ),
  );
  const [resendError, setResendError] = useState("");

  const isResending = resendStatus === "sending";

  const handleResendEmail = async () => {
    if (!registration || isResending || resendStatus === "unavailable") return;

    setResendStatus("sending");
    setResendError("");

    try {
      await BookingAPI.resendInitialPasswordEmail(registration.hiker.id);
      setResendStatus("sent");
    } catch (error) {
      const unavailable =
        error instanceof BookingApiError && error.status === 409;

      setResendStatus(unavailable ? "unavailable" : "failed");
      setResendError(
        error instanceof Error
          ? error.message
          : "The email could not be sent. Please try again.",
      );
    }
  };

  /**
   * @param {keyof typeof emptyDraft} field
   * @returns {(event: import("react").ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void}
   */
  const updateDraft = (field) => (event) => {
    const value = event.target.value;
    setNewHikerDraft((draft) => ({ ...draft, [field]: value }));
    if (field === "email") setEmailError("");
  };

  // Start every registration from an empty form.
  const resetForm = () => {
    setNewHikerDraft(emptyDraft);
    setErrorMessage("");
    setResendStatus("idle");
    setResendError("");
    setTouched({});
    setSubmitted(false);
    setEmailError("");
  };

  const handleCreateAccount = async () => {
    const firstName = newHikerDraft.firstName.trim();
    const lastName = newHikerDraft.lastName.trim();
    const fullName = `${firstName} ${lastName}`;
    const email = newHikerDraft.email.trim();
    const phone = newHikerDraft.phone.trim();
    const notes = newHikerDraft.notes.trim();
    const emergencyContact = readEmergencyContact(newHikerDraft);

    setSubmitted(true);
    setErrorMessage("");

    const firstInvalid = Object.keys(errors)[0] || (emailError ? "email" : "");
    if (firstInvalid) {
      const suffix =
        firstInvalid === "firstName"
          ? "first-name"
          : firstInvalid === "lastName"
            ? "last-name"
            : firstInvalid;

      document.getElementById(`staff-new-hiker-${suffix}`)?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      await onRegister({
        type: "new",
        fullName,
        email,
        phone,
        notes: notes || null,
        emergencyContact: emergencyContact.text || null,
      });
    } catch (error) {
      if (
        error instanceof BookingApiError &&
        error.code === "EMAIL_ALREADY_REGISTERED"
      ) {
        setEmailError(error.message);
        document.getElementById("staff-new-hiker-email")?.focus();
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not create the account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={() => {
        if (!isResending) onHide();
      }}
      onEntered={() => firstNameRef.current?.focus()}
      onExited={resetForm}
      centered
      aria-labelledby="register-hiker-title"
    >
      {registration ? (
        <>
          <Modal.Body className="text-center p-4">
            <SuccessCheck />

            <h2 id="register-hiker-title" className="h4 mt-3">
              Hiker account created
            </h2>

            <p className="fw-semibold mb-2">{registration.hiker.fullName}</p>

            <p className="text-body-secondary mb-2">
              {registration.hiker.email}
            </p>

            <div aria-live="polite">
              {resendError ? (
                <p className="text-danger mb-2">{resendError}</p>
              ) : (
                <p className="text-body-secondary mb-2">
                  {resendStatus === "sent"
                    ? "A new temporary password was sent. Use the most recent email to sign in."
                    : isResending
                      ? "Sending a new temporary password…"
                      : registration.passwordSent
                        ? "The temporary password was sent. The hiker will choose a new password at first sign-in."
                        : "The account was created, but the email could not be sent."}
                </p>
              )}
            </div>

            {resendStatus !== "unavailable" && (
              <button
                type="button"
                className="cap-outline"
                onClick={handleResendEmail}
                disabled={isResending}
              >
                {isResending
                  ? "Sending…"
                  : resendStatus === "failed" ||
                      (resendStatus === "idle" && !registration.passwordSent)
                    ? "Retry email"
                    : "Resend email"}
              </button>
            )}
          </Modal.Body>

          <Modal.Footer>
            <button
              type="button"
              className="cap-primary w-100 d-flex align-items-center justify-content-center"
              disabled={isResending}
              onClick={() => {
                onContinue?.(registration.hiker);
                onHide();
              }}
            >
              {onContinue ? "Continue to booking" : "Close"}
            </button>
          </Modal.Footer>
        </>
      ) : (
        <>
          <Modal.Header closeButton>
            <Modal.Title id="register-hiker-title">
              Register a new hiker
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {errorMessage && (
              <Alert variant="danger" role="alert">
                {errorMessage}
              </Alert>
            )}
            <Form.Group className="mb-3" controlId="staff-new-hiker-first-name">
              <Form.Label>First name</Form.Label>
              <Form.Control
                ref={firstNameRef}
                autoComplete="given-name"
                placeholder="E.g. Alex"
                value={newHikerDraft.firstName}
                required
                onChange={updateDraft("firstName")}
                {...validationProps("firstName")}
              />
              {feedback("firstName")}
            </Form.Group>

            <Form.Group className="mb-3" controlId="staff-new-hiker-last-name">
              <Form.Label>Last name</Form.Label>
              <Form.Control
                autoComplete="family-name"
                placeholder="E.g. Rossi"
                value={newHikerDraft.lastName}
                required
                onChange={updateDraft("lastName")}
                {...validationProps("lastName")}
              />
              {feedback("lastName")}
            </Form.Group>

            <Form.Group className="mb-3" controlId="staff-new-hiker-email">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                value={newHikerDraft.email}
                onChange={updateDraft("email")}
                {...validationProps("email")}
              />
              {feedback("email")}
            </Form.Group>

            <Form.Group className="mb-3" controlId="staff-new-hiker-phone">
              <Form.Label>Mobile number</Form.Label>
              <Form.Control
                type="tel"
                required
                autoComplete="tel"
                maxLength={30}
                placeholder="E.g. +39 333 123 4567"
                value={newHikerDraft.phone}
                onChange={updateDraft("phone")}
                {...validationProps("phone")}
              />
              {feedback("phone")}
            </Form.Group>

            <Form.Group className="mb-3" controlId="staff-new-hiker-notes">
              <Form.Label>Notes (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                maxLength={MAX_TEXT_LENGTH}
                placeholder="E.g. Registered mountain guide"
                value={newHikerDraft.notes}
                onChange={updateDraft("notes")}
                {...validationProps("notes")}
              />
              {feedback("notes")}
            </Form.Group>

            <EmergencyContactFields
              prefix="staff-new-hiker"
              values={newHikerDraft}
              onChange={(field, value) =>
                setNewHikerDraft((draft) => ({ ...draft, [field]: value }))
              }
              onBlur={markTouched}
              errorFor={visibleError}
              disabled={isSubmitting}
            />
          </Modal.Body>

          <Modal.Footer>
            <button type="button" className="cap-outline" onClick={onHide}>
              Cancel
            </button>
            <button
              type="button"
              className="cap-primary"
              disabled={isSubmitting}
              onClick={handleCreateAccount}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" animation="border" aria-hidden="true" />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
}
