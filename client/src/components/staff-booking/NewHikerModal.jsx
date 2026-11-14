import { useRef, useState } from "react";
import { Col, Form, Modal, Row } from "react-bootstrap";

import SuccessCheck from "../common/SuccessCheck.jsx";

/**
 * @typedef {Object} RegistrationResult
 * @property {import("../../models/models.js").HikerDTO} hiker
 * @property {boolean} emailSent
 */

/**
 * @param {{
 *   show: boolean,
 *   onHide: () => void,
 *   registration?: RegistrationResult | null,
 *   onContinue?: (hiker: RegistrationResult["hiker"]) => void,
 * }} props
 */
export default function NewHikerModal({
  show,
  onHide,
  registration = null,
  onContinue,
}) {
  const [newHikerDraft, setNewHikerDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const firstNameRef = useRef(/** @type {HTMLInputElement | null} */ (null));

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
              {registration.emailSent
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
            {/* TODO: Feat — New Hiker First Login

                This modal already has two views: "Register a new hiker" and
                "Hiker account created". Connect the existing views as follows:

                1. Wire Create account to a submit handler. Require a non-blank
                first name and a valid email. Trim firstName and lastName, then
                join the non-empty parts with a space to build fullName.
                Send fullName, email, and optional phone through
                BookingAPI.createHiker in client/src/API/booking-api.js
                with type: "new".
                Show "Creating account…" and disable submission while it runs.
                If account creation fails, keep the form open with its values.

                3. In client/src/components/staff-booking/StaffBookingForm.jsx,
                pass onContinue so the "Continue to booking" button selects the
                new hiker in Existing and preserves the booking details.
                Keep the button enabled once the account is created, even if
                sending the password email fails. Clear the registration result
                when the modal closes.

                The first-login password change is already implemented on
                origin/feature/new-hiker-login. See
                client/src/components/auth/ChangePasswordForm.jsx and
                server/routes/auth-routes.js on that branch. */}
            <button type="button" className="cap-primary" disabled>
              Create account
            </button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
}
