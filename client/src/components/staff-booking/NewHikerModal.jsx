import { useRef, useState } from "react";
import { Alert, Col, Form, Modal, Row, Spinner } from "react-bootstrap";

import SuccessCheck from "../common/SuccessCheck.jsx";

// Limits enforced by the staff hiker API.
const MAX_TEXT_LENGTH = 500;

const emptyDraft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  notes: "",
  emergencyContact: "",
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

  /**
   * @param {keyof typeof emptyDraft} field
   * @returns {(event: import("react").ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void}
   */
  const updateDraft = (field) => (event) =>
    setNewHikerDraft((draft) => ({ ...draft, [field]: event.target.value }));

  // Start every registration from an empty form.
  const resetForm = () => {
    setNewHikerDraft(emptyDraft);
    setErrorMessage("");
  };

  const handleCreateAccount = async () => {
    const firstName = newHikerDraft.firstName.trim();
    const lastName = newHikerDraft.lastName.trim();
    const email = newHikerDraft.email.trim();
    const phone = newHikerDraft.phone.trim();
    const notes = newHikerDraft.notes.trim();
    const emergencyContact = newHikerDraft.emergencyContact.trim();

    let validationError = "";

    if (!firstName) {
      validationError = "Enter the hiker's first name.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationError = "Enter a valid email address.";
    } else if (!isValidPhone(phone)) {
      validationError =
        "Enter a valid mobile number (6–15 digits, optional leading +).";
    }

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await onRegister({
        type: "new",
        fullName: [firstName, lastName].filter(Boolean).join(" "),
        email,
        phone,
        notes: notes || null,
        emergencyContact: emergencyContact || null,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create the account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
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

            <p className="text-body-secondary mb-0" role="status">
              {registration.passwordSent
                ? `The temporary password was sent to ${registration.hiker.email}. The hiker will need to change it at first sign-in.`
                : "The account was created, but the email could not be sent."}
            </p>
          </Modal.Body>

          <Modal.Footer>
            <button
              type="button"
              className="cap-primary w-100"
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
            <Row className="g-3 mb-3">
              <Col xs={12} sm={6}>
                <Form.Group controlId="staff-new-hiker-first-name">
                  <Form.Label>First name</Form.Label>
                  <Form.Control
                    ref={firstNameRef}
                    autoComplete="given-name"
                    maxLength={100}
                    value={newHikerDraft.firstName}
                    required
                    onChange={updateDraft("firstName")}
                  />
                </Form.Group>
              </Col>

              <Col xs={12} sm={6}>
                <Form.Group controlId="staff-new-hiker-last-name">
                  <Form.Label>Last name (optional)</Form.Label>
                  <Form.Control
                    autoComplete="family-name"
                    maxLength={100}
                    value={newHikerDraft.lastName}
                    onChange={updateDraft("lastName")}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3" controlId="staff-new-hiker-email">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                value={newHikerDraft.email}
                onChange={updateDraft("email")}
              />
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
              />
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
              />
            </Form.Group>

            <Form.Group controlId="staff-new-hiker-emergency-contact">
              <Form.Label>Emergency contact (optional)</Form.Label>
              <Form.Control
                maxLength={MAX_TEXT_LENGTH}
                placeholder="E.g. Anna Rossi, +39 333 765 4321"
                value={newHikerDraft.emergencyContact}
                onChange={updateDraft("emergencyContact")}
              />
            </Form.Group>
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
