import { useId } from "react";
import { Button, Form } from "react-bootstrap";

import { MAX_SPECIAL_REQUEST_LENGTH } from "../../utils/booking-requirements.js";

/**
 * @param {{
 *   requests: import("../../utils/booking-requirements.js").BookingRequests,
 *   onChange: (requests: import("../../utils/booking-requirements.js").BookingRequests) => void,
 *   partySize: number,
 *   staff?: boolean,
 *   disabled?: boolean,
 * }} props
 */
export default function BookingRequestFields({
  requests,
  onChange,
  partySize,
  staff = false,
  disabled = false,
}) {
  const id = useId();
  const { dietaryRequirements, special } = requests;

  /**
   * @param {number} index
   * @param {Partial<import("../../utils/booking-requirements.js").DietaryRequirement>} changes
   */
  function updateRequirement(index, changes) {
    onChange({
      ...requests,
      dietaryRequirements: dietaryRequirements.map((entry, position) =>
        position === index ? { ...entry, ...changes } : entry,
      ),
    });
  }

  return (
    <div className="d-grid gap-3">
      <fieldset className="d-grid gap-3" disabled={disabled}>
        <legend className="h6 mb-0">
          {partySize === 1
            ? staff
              ? "Does the hiker have any food allergies, intolerances, or other dietary requirements?"
              : "Do you have any food allergies, intolerances, or other dietary requirements?"
            : "Does anyone in the party have any food allergies, intolerances, or other dietary requirements?"}
          {" (required)"}
        </legend>

        <div>
          <Form.Check
            id={`${id}-dietary-no`}
            name={`${id}-dietary-answer`}
            type="radio"
            label={
              partySize === 1
                ? staff
                  ? "No, the hiker has no dietary requirements."
                  : "No, I have no dietary requirements."
                : "No, no one in the party has any dietary requirements."
            }
            checked={requests.dietaryAnswer === "no"}
            required
            onChange={() => onChange({ ...requests, dietaryAnswer: "no" })}
          />
          <Form.Check
            id={`${id}-dietary-yes`}
            name={`${id}-dietary-answer`}
            type="radio"
            label={
              partySize === 1
                ? staff
                  ? "Yes, the hiker has one or more dietary requirements."
                  : "Yes, I have one or more dietary requirements."
                : "Yes, someone in the party has a dietary requirement."
            }
            checked={requests.dietaryAnswer === "yes"}
            required
            onChange={() =>
              onChange({
                ...requests,
                dietaryAnswer: "yes",
                dietaryRequirements: dietaryRequirements.length
                  ? dietaryRequirements
                  : [{ description: "", hasAllergies: false }],
              })
            }
          />
        </div>
        {requests.dietaryAnswer === "yes" && (
          <>
            <Form.Text>
              {partySize === 1
                ? "Complete the dietary requirement below."
                : `Complete at least one dietary requirement. You can add up to ${partySize} entries, one per guest.`}
            </Form.Text>

            {dietaryRequirements.length > partySize && (
              <p className="text-danger small mb-0" role="alert">
                Remove the extra entries to match the number of guests.
              </p>
            )}

            {dietaryRequirements.map((requirement, index) => {
              const descriptionId = `${id}-dietary-${index}`;
              const errorId = `${descriptionId}-error`;
              const missingDescription =
                requirement.hasAllergies && !requirement.description.trim();

              return (
                <fieldset
                  key={index}
                  className="border rounded-3 p-3 d-grid gap-2"
                >
                  <legend className="h6 mb-0">Guest {index + 1}</legend>

                  <Form.Group controlId={descriptionId}>
                    <Form.Label>Description</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      maxLength={MAX_SPECIAL_REQUEST_LENGTH}
                      value={requirement.description}
                      placeholder={
                        partySize === 1
                          ? "E.g. Vegetarian meal"
                          : "E.g. 2 guests need vegetarian meals"
                      }
                      isInvalid={missingDescription}
                      aria-describedby={
                        missingDescription ? errorId : undefined
                      }
                      onChange={(event) =>
                        updateRequirement(index, {
                          description: event.target.value,
                        })
                      }
                    />
                    {requirement.description.length >=
                      MAX_SPECIAL_REQUEST_LENGTH && (
                      <Form.Text className="text-danger">
                        This description has reached the 1,000-character limit.
                      </Form.Text>
                    )}
                    {missingDescription && (
                      <Form.Control.Feedback id={errorId} type="invalid">
                        Describe the food allergy before confirming the booking.
                      </Form.Control.Feedback>
                    )}
                  </Form.Group>

                  <Form.Check
                    id={`${id}-allergy-${index}`}
                    type="checkbox"
                    label="This requirement involves a food allergy"
                    checked={requirement.hasAllergies}
                    onChange={(event) =>
                      updateRequirement(index, {
                        hasAllergies: event.target.checked,
                      })
                    }
                  />

                  <div>
                    <Button
                      type="button"
                      variant="outline-secondary"
                      size="sm"
                      aria-label={`Remove dietary requirement ${index + 1}`}
                      onClick={() =>
                        onChange({
                          ...requests,
                          dietaryRequirements: dietaryRequirements.filter(
                            (_, position) => position !== index,
                          ),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </fieldset>
              );
            })}

            <div>
              <Button
                type="button"
                variant="outline-secondary"
                disabled={disabled || dietaryRequirements.length >= partySize}
                onClick={() =>
                  onChange({
                    ...requests,
                    dietaryRequirements: [
                      ...dietaryRequirements,
                      { description: "", hasAllergies: false },
                    ],
                  })
                }
              >
                Add dietary requirement
              </Button>
            </div>
          </>
        )}
      </fieldset>

      <Form.Group controlId={`${id}-special`}>
        <Form.Label>Special requests (optional)</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          maxLength={MAX_SPECIAL_REQUEST_LENGTH}
          value={special}
          disabled={disabled}
          aria-describedby={`${id}-special-help`}
          placeholder={
            partySize === 1
              ? staff
                ? "E.g. The hiker may arrive about 20 minutes late."
                : "E.g. I may arrive about 20 minutes late."
              : staff
                ? "E.g. The group may arrive about 20 minutes late."
                : "E.g. We may arrive about 20 minutes late."
          }
          onChange={(event) =>
            onChange({ ...requests, special: event.target.value })
          }
        />
        <Form.Text
          id={`${id}-special-help`}
          className={
            special.length >= MAX_SPECIAL_REQUEST_LENGTH
              ? "text-danger"
              : undefined
          }
        >
          {special.length >= MAX_SPECIAL_REQUEST_LENGTH
            ? "Special requests have reached the 1,000-character limit."
            : "Let us know if there’s anything else we should know about your booking."}
        </Form.Text>
      </Form.Group>
    </div>
  );
}
