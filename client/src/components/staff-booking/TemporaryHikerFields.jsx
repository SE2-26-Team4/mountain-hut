import { Col, Form, Row } from "react-bootstrap";

/** @param {{
 *   temporaryName: string,
 *   setTemporaryName: (value: string) => void,
 *   temporaryLastName: string,
 *   setTemporaryLastName: (value: string) => void,
 *   temporaryPhone: string,
 *   setTemporaryPhone: (value: string) => void,
 *   temporaryEmail: string,
 *   setTemporaryEmail: (value: string) => void,
 * }} props */
export default function TemporaryHikerFields({
  temporaryName,
  setTemporaryName,
  temporaryLastName,
  setTemporaryLastName,
  temporaryPhone,
  setTemporaryPhone,
  temporaryEmail,
  setTemporaryEmail,
}) {
  return (
    <Row className="g-3 mt-1">
      <Col xs={12} sm={6} xl={3}>
        <Form.Group controlId="staff-temporary-name">
          <Form.Label>First name</Form.Label>
          <Form.Control
            type="text"
            value={temporaryName}
            onChange={(event) => setTemporaryName(event.target.value)}
            required
          />
        </Form.Group>
      </Col>
      <Col xs={12} sm={6} xl={3}>
        <Form.Group controlId="staff-temporary-last-name">
          <Form.Label>Last name (optional)</Form.Label>
          <Form.Control
            type="text"
            autoComplete="family-name"
            value={temporaryLastName}
            onChange={(event) => setTemporaryLastName(event.target.value)}
          />
        </Form.Group>
      </Col>
      <Col xs={12} sm={6} xl={3}>
        <Form.Group controlId="staff-temporary-phone">
          <Form.Label>Phone (optional)</Form.Label>
          <Form.Control
            type="tel"
            value={temporaryPhone}
            onChange={(event) => setTemporaryPhone(event.target.value)}
          />
        </Form.Group>
      </Col>
      <Col xs={12} sm={6} xl={3}>
        <Form.Group controlId="staff-temporary-email">
          <Form.Label>Email (optional)</Form.Label>
          <Form.Control
            type="email"
            value={temporaryEmail}
            onChange={(event) => setTemporaryEmail(event.target.value)}
          />
        </Form.Group>
      </Col>
    </Row>
  );
}
