import { useId, useRef, useState } from 'react';

import { useModalDialog } from '../../hooks/useModalDialog.js';
import StaffIcon from './StaffIcons.jsx';

/**
 * @typedef {import('../../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../../models/models.js').MealSlotInputDTO} MealSlotInputDTO
 * @typedef {import('../../models/models.js').DiningTableInputDTO} DiningTableInputDTO
 *
 * @typedef {{
 *   kind: 'table',
 *   item?: DiningTableDTO,
 *   takenNames: string[],
 *   onSubmit: (input: DiningTableInputDTO) => Promise<void>,
 *   onClose: () => void,
 * }} TableFormProps
 *
 * @typedef {{
 *   kind: 'slot',
 *   item?: MealSlotDTO,
 *   takenNames: string[],
 *   onSubmit: (input: MealSlotInputDTO) => Promise<void>,
 *   onClose: () => void,
 * }} SlotFormProps
 *
 * @typedef {{
 *   name: string,
 *   seatCount: string,
 *   startTime: string,
 *   endTime: string,
 *   isActive: boolean,
 * }} FormValues
 *
 * @typedef {Partial<Record<'name' | 'seatCount' | 'startTime' | 'endTime', string>>} FieldErrors
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const SEAT_PATTERN = /^\d+$/;

/**
 * Applies the same rules as server/services/capacity-validation.js, plus a
 * unique-name check matching the database constraint.
 *
 * @param {'table' | 'slot'} kind
 * @param {FormValues} values
 * @param {string[]} takenNames
 * @returns {FieldErrors}
 */
function validate(kind, values, takenNames) {
  /** @type {FieldErrors} */
  const errors = {};
  const name = values.name.trim().toLowerCase();

  if (!name) {
    errors.name = 'Enter a name.';
  } else if (takenNames.some((takenName) => takenName.trim().toLowerCase() === name)) {
    errors.name = `Another ${kind === 'table' ? 'table' : 'time slot'} already uses this name.`;
  }

  if (kind === 'table') {
    if (!SEAT_PATTERN.test(values.seatCount) || Number(values.seatCount) < 1) {
      errors.seatCount = 'Enter a whole number of seats greater than zero.';
    }

    return errors;
  }

  if (!TIME_PATTERN.test(values.startTime)) {
    errors.startTime = 'Enter a start time.';
  }

  if (!TIME_PATTERN.test(values.endTime)) {
    errors.endTime = 'Enter an end time.';
  } else if (!errors.startTime && values.endTime <= values.startTime) {
    errors.endTime = 'End time must be later than the start time.';
  }

  return errors;
}

/**
 * Links an input to its error message for assistive technologies.
 *
 * @param {string} id
 * @param {string | undefined} error
 */
function errorAttributes(id, error) {
  return error
    ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` }
    : {};
}

/**
 * @param {{ id: string, label: string, error?: string, children: import('react').ReactNode }} props
 */
function FormField({ id, label, error, children }) {
  return (
    <div className="staff-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p id={`${id}-error`} className="staff-field__error">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Dialog to add or edit a dining table or a meal slot.
 *
 * @param {TableFormProps | SlotFormProps} props
 */
export default function CapacityFormModal(props) {
  const { kind, item, takenNames, onClose } = props;
  const isEdit = item !== undefined;
  const noun = kind === 'table' ? 'table' : 'time slot';

  const baseId = useId();
  const nameRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const dialogRef = useModalDialog(nameRef);

  const [values, setValues] = useState(
    /** @returns {FormValues} */ () => ({
      name: item?.name ?? '',
      seatCount: props.kind === 'table' && props.item ? String(props.item.seatCount) : '',
      startTime: props.kind === 'slot' && props.item ? props.item.startTime : '',
      endTime: props.kind === 'slot' && props.item ? props.item.endTime : '',
      isActive: item?.isActive ?? true,
    }),
  );
  const [errors, setErrors] = useState(/** @type {FieldErrors} */ ({}));
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const seatCount = SEAT_PATTERN.test(values.seatCount) ? Number(values.seatCount) : 0;

  /**
   * @param {keyof FormValues} field
   * @param {string | boolean} value
   */
  function updateValue(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  /**
   * @param {number} delta
   */
  function stepSeatCount(delta) {
    updateValue('seatCount', String(Math.max(1, seatCount + delta)));
  }

  /**
   * @param {import('react').FormEvent<HTMLFormElement>} event
   */
  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validate(kind, values, takenNames);

    setErrors(nextErrors);
    setSubmitError('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const name = values.name.trim();
    // The API requires the active status on updates and defaults it on creation.
    const activeStatus = isEdit ? { isActive: values.isActive } : {};

    setSubmitting(true);

    try {
      if (props.kind === 'table') {
        await props.onSubmit({ name, seatCount: Number(values.seatCount), ...activeStatus });
      } else {
        await props.onSubmit({
          name,
          startTime: values.startTime,
          endTime: values.endTime,
          ...activeStatus,
        });
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : `The ${noun} could not be saved.`);
      setSubmitting(false);
    }
  }

  const ids = {
    title: `${baseId}-title`,
    name: `${baseId}-name`,
    seatCount: `${baseId}-seats`,
    startTime: `${baseId}-start`,
    endTime: `${baseId}-end`,
  };

  return (
    <dialog
      ref={dialogRef}
      className="staff-modal"
      aria-labelledby={ids.title}
      onCancel={(event) => {
        if (submitting) {
          event.preventDefault();
        }
      }}
      onClose={onClose}
    >
      <form className="staff-modal__form" noValidate onSubmit={handleSubmit}>
        <div className="staff-modal__header">
          <div>
            <h2 id={ids.title}>{isEdit ? `Edit ${noun}` : `Add ${noun}`}</h2>
            {item && <p>{item.name}</p>}
          </div>
          <button
            type="button"
            className="staff-button staff-button--icon"
            aria-label="Close"
            disabled={submitting}
            onClick={onClose}
          >
            <StaffIcon name="close" />
          </button>
        </div>

        <div className="staff-modal__body">
          <FormField id={ids.name} label="Name" error={errors.name}>
            <input
              ref={nameRef}
              id={ids.name}
              type="text"
              maxLength={60}
              placeholder={kind === 'table' ? 'e.g. Table 5' : 'e.g. Lunch 12:00'}
              value={values.name}
              onChange={(event) => updateValue('name', event.target.value)}
              {...errorAttributes(ids.name, errors.name)}
            />
          </FormField>

          {kind === 'table' ? (
            <FormField id={ids.seatCount} label="Seats" error={errors.seatCount}>
              <div className="staff-stepper">
                <input
                  id={ids.seatCount}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={values.seatCount}
                  onChange={(event) => updateValue('seatCount', event.target.value)}
                  {...errorAttributes(ids.seatCount, errors.seatCount)}
                />
                <button
                  type="button"
                  className="staff-button staff-button--secondary staff-stepper__button"
                  aria-label="Decrease seats"
                  aria-controls={ids.seatCount}
                  disabled={seatCount <= 1}
                  onClick={() => stepSeatCount(-1)}
                >
                  <StaffIcon name="minus" />
                </button>
                <button
                  type="button"
                  className="staff-button staff-button--secondary staff-stepper__button"
                  aria-label="Increase seats"
                  aria-controls={ids.seatCount}
                  onClick={() => stepSeatCount(1)}
                >
                  <StaffIcon name="plus" />
                </button>
              </div>
            </FormField>
          ) : (
            <div className="staff-field-row">
              <FormField id={ids.startTime} label="Start time" error={errors.startTime}>
                <input
                  id={ids.startTime}
                  type="time"
                  value={values.startTime}
                  onChange={(event) => updateValue('startTime', event.target.value)}
                  {...errorAttributes(ids.startTime, errors.startTime)}
                />
              </FormField>
              <FormField id={ids.endTime} label="End time" error={errors.endTime}>
                <input
                  id={ids.endTime}
                  type="time"
                  value={values.endTime}
                  onChange={(event) => updateValue('endTime', event.target.value)}
                  {...errorAttributes(ids.endTime, errors.endTime)}
                />
              </FormField>
            </div>
          )}

          {isEdit && (
            <label className="staff-toggle">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(event) => updateValue('isActive', event.target.checked)}
              />
              <span>
                Active
                <small>
                  {kind === 'table'
                    ? 'Inactive tables stay assigned but are not counted in slot capacity.'
                    : 'Inactive time slots are not offered to hikers.'}
                </small>
              </span>
            </label>
          )}

          {submitError && (
            <p className="staff-form-error" role="alert">
              {submitError}
            </p>
          )}
        </div>

        <div className="staff-modal__footer">
          <button
            type="button"
            className="staff-button staff-button--secondary"
            disabled={submitting}
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="staff-button staff-button--primary" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : `Add ${noun}`}
          </button>
        </div>
      </form>
    </dialog>
  );
}
