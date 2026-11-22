import { Col, Form, Row } from "react-bootstrap";

const CONTACT_FIELDS = /** @type {const} */ ([
  {
    name: "contactName",
    label: "Contact name",
    type: "text",
    placeholder: "E.g. Anna Rossi",
  },
  {
    name: "contactPhone",
    label: "Phone number",
    type: "tel",
    placeholder: "E.g. +39 333 765 4321",
  },
]);

/**
 * @typedef {"contactName" | "contactPhone"} ContactField
 */

/**
 * @param {{
 *   prefix: string,
 *   values: Record<ContactField, string>,
 *   onChange: (field: ContactField, value: string) => void,
 *   onBlur?: (field: ContactField) => void,
 *   errorFor?: (field: ContactField) => string,
 *   disabled?: boolean
 * }} props
 */
export default function EmergencyContactFields({
  prefix,
  values,
  onChange,
  onBlur,
  errorFor,
  disabled,
}) {
  return (
    <fieldset
      disabled={disabled}
      className={`border-top py-2${prefix === "signup" ? " border-bottom" : ""}`}
    >
      <legend className="form-label">Emergency contact (optional)</legend>

      <Row className="gx-3 gy-2">
        {CONTACT_FIELDS.map(({ name, label, type, placeholder }) => {
          const id = `${prefix}-${name}`;
          const error = errorFor?.(name);

          return (
            <Col key={name} xs={12} md={6}>
              <Form.Group controlId={id}>
                <Form.Label>{label}</Form.Label>
                <Form.Control
                  name={name}
                  type={type}
                  autoComplete="off"
                  placeholder={placeholder}
                  value={values[name]}
                  isInvalid={Boolean(error)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(event) => onChange(name, event.target.value)}
                  onBlur={() => onBlur?.(name)}
                />

                {error && (
                  <Form.Text id={`${id}-error`} className="text-danger">
                    {error}
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
          );
        })}
      </Row>
    </fieldset>
  );
}
