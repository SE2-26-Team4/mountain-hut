/**
 * @param {{ contactName: string, contactPhone: string }} values
 */
export function readEmergencyContact(values) {
  const name = values.contactName.trim();
  const phone = values.contactPhone.trim();
  const text = [name, phone].filter(Boolean).join(", ");

  /** @type {Partial<Record<"contactName" | "contactPhone", string>>} */
  const errors = {};

  if (phone && !name) {
    errors.contactName = "Enter the contact's name.";
  }

  if (name && !phone) {
    errors.contactPhone = "Enter the contact's phone number.";
  } else if (phone) {
    const digits = phone.replace(/[\s().-]/g, "");

    if (phone.length > 30 || !/^\+?\d{6,15}$/.test(digits)) {
      errors.contactPhone = "Enter 6 to 15 digits, optionally starting with +.";
    }
  }

  if (text.length > 500) {
    errors.contactName =
      "Use 500 characters or fewer for the emergency contact.";
  }

  return { text, errors };
}
