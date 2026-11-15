import { useRef, useState } from "react";
import { Alert, Col, Form, Modal, Row, Spinner } from "react-bootstrap";

import SuccessCheck from "../common/SuccessCheck.jsx";

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
  const [newHikerDraft, setNewHikerDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const firstNameRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleCreateAccount = async () => {
    const firstName = newHikerDraft.firstName.trim();
    const lastName = newHikerDraft.lastName.trim();
    const email = newHikerDraft.email.trim();
    const phone = newHikerDraft.phone.trim();

    if (!firstName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage("Enter a first name and a valid email address.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await onRegister({
        type: "new",
        fullName: [firstName, lastName].filter(Boolean).join(" "),
        email,
        phone: phone || null,
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
                    value={newHikerDraft.firstName}
                    required
                    onChange={(event) =>
                      setNewHikerDraft({
                        ...newHikerDraft,
                        firstName: event.target.value,
                      })
                    }
                  />
                </Form.Group>
              </Col>

              <Col xs={12} sm={6}>
                <Form.Group controlId="staff-new-hiker-last-name">
                  <Form.Label>Last name (optional)</Form.Label>
                  <Form.Control
                    autoComplete="family-name"
                    value={newHikerDraft.lastName}
                    onChange={(event) =>
                      setNewHikerDraft({
                        ...newHikerDraft,
                        lastName: event.target.value,
                      })
                    }
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
                value={newHikerDraft.email}
                onChange={(event) =>
                  setNewHikerDraft({
                    ...newHikerDraft,
                    email: event.target.value,
                  })
                }
              />
            </Form.Group>

            <Form.Group controlId="staff-new-hiker-phone">
              <Form.Label>Phone (optional)</Form.Label>
              <Form.Control
                type="tel"
                autoComplete="tel"
                value={newHikerDraft.phone}
                onChange={(event) =>
                  setNewHikerDraft({
                    ...newHikerDraft,
                    phone: event.target.value,
                  })
                }
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
