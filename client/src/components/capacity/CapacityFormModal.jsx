import { Col, Form, Modal, Row, Spinner } from 'react-bootstrap';

import Alert from '../common/AutoDismissAlert.jsx';

/**
 * @typedef {Object} TableForm
 * @property {string} name
 * @property {string} seatCount
 * @property {boolean} isActive
 */

/**
 * @typedef {Object} SlotForm
 * @property {string} slotDate
 * @property {string} name
 * @property {string} startTime
 * @property {string} endTime
 * @property {boolean} isActive
 */

/**
 * @typedef {Object} CommonProps
 * @property {boolean} show
 * @property {() => void} onHide
 * @property {import('react').ChangeEventHandler<HTMLInputElement>} onChange
 * @property {import('react').SubmitEventHandler<HTMLFormElement>} onSubmit
 * @property {boolean} editing
 * @property {boolean} saving
 * @property {string} error
 */

/**
 * @typedef {CommonProps & (
 *   { kind: 'table', form: TableForm } |
 *   { kind: 'slot', form: SlotForm }
 * )} CapacityFormModalProps
 */

/**
 * @param {CapacityFormModalProps} props
 */
export default function CapacityFormModal(props) {
  const {
    show,
    onHide,
    onChange,
    onSubmit,
    editing,
    saving,
    error,
  } = props;

  const label = props.kind === 'table' ? 'table' : 'time slot';

  const isSlotPreview = props.kind === 'slot' && editing;

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
    >
      <Form
        onSubmit={(event) => {
          if (isSlotPreview) {
            event.preventDefault();
            return;
          }

          onSubmit(event);
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {isSlotPreview ? 'View' : editing ? 'Edit' : 'Add'} {label}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {props.kind === 'slot' && (
            <div className="bg-light rounded-3 px-3 py-3 mb-4">
              <span className="d-block small text-secondary mb-1">
                Selected date
              </span>

              <span className="fw-semibold">
                {new Date(`${props.form.slotDate}T12:00:00`).toLocaleDateString(
                  'en-GB',
                  {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }
                )}
              </span>
            </div>
          )}

          {error && (
            <Alert variant="danger">
              {error}
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label>
              {props.kind === 'table' ? 'Table name' : 'Service name'}
            </Form.Label>

            <Form.Control
              name="name"
              value={props.form.name}
              onChange={onChange}
              required
              placeholder={props.kind === 'table' ? 'Table 1' : 'Lunch'}
              disabled={isSlotPreview}
            />
          </Form.Group>

          {props.kind === 'table' ? (
            <Form.Group>
              <Form.Label>Number of seats</Form.Label>

              <Form.Control
                type="number"
                name="seatCount"
                min="1"
                step="1"
                required
                value={props.form.seatCount}
                onChange={onChange}
                disabled={isSlotPreview}
              />
            </Form.Group>
          ) : (
            <Row>
              <Col xs={6}>
                <Form.Group>
                  <Form.Label>Starts</Form.Label>

                  <Form.Control
                    type="time"
                    name="startTime"
                    value={props.form.startTime}
                    onChange={onChange}
                    required
                    disabled={isSlotPreview}
                  />
                </Form.Group>
              </Col>

              <Col xs={6}>
                <Form.Group>
                  <Form.Label>Ends</Form.Label>

                  <Form.Control
                    type="time"
                    name="endTime"
                    value={props.form.endTime}
                    onChange={onChange}
                    required
                    disabled={isSlotPreview}
                  />
                </Form.Group>
              </Col>
            </Row>
          )}

          <Form.Check
            className="mt-3"
            type="switch"
            name="isActive"
            label="Active"
            checked={props.form.isActive}
            onChange={onChange}
          />
        </Modal.Body>

        {!isSlotPreview && (
          <Modal.Footer>
            <button
              type="button"
              className="cap-outline"
              onClick={onHide}
              disabled={saving || isSlotPreview}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="cap-primary"
              disabled={saving}
            >
              {saving ? (
                <Spinner
                  size="sm"
                  animation="border"
                />
              ) : (
                `Save ${label}`
              )}
            </button>
          </Modal.Footer>
        )}
      </Form>
    </Modal>
  );
}