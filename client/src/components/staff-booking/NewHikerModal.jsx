import { useState } from "react";
import { Form, Modal } from "react-bootstrap";

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
    fullName: "",
    email: "",
    phone: "",
  });

  return (
    <Modal
      show={show}
      onHide={onHide}
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
            <Form.Group className="mb-3" controlId="staff-new-hiker-name">
              <Form.Label>Full name</Form.Label>
              <Form.Control
                autoComplete="name"
                value={newHikerDraft.fullName}
                onChange={(event) =>
                  setNewHikerDraft({
                    ...newHikerDraft,
                    fullName: event.target.value,
                  })
                }
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="staff-new-hiker-email">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
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

            <button type="button" className="cap-primary" disabled>
              Create account
            </button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
}
