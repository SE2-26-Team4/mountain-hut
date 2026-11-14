import { useEffect, useRef } from "react";

import useBookingLogic from "../../hooks/useBookingLogic.js";
import Alert from "../common/AutoDismissAlert.jsx";
import BookingAvailability from "./BookingAvailability.jsx";
import BookingConfirmationModal from "./BookingConfirmationModal.jsx";
import BookingSearch from "./BookingSearch.jsx";

/**
 * @typedef {import("../../API/session-api.js").SessionUser} SessionUser
 * @typedef {import("../../models/models.js").MealSlotAvailabilityDTO} MealSlotAvailabilityDTO
 */

/**
 * @param {Object} props
 * @param {SessionUser | null} props.user
 * @param {() => void} [props.onRequireLogin]
 */
export default function BookingForm({ user, onRequireLogin }) {
  const booking = useBookingLogic({ user, onRequireLogin });

  const availabilityRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const previousAvailabilityRef = useRef(
    /** @type {MealSlotAvailabilityDTO | null} */ (null),
  );

  useEffect(() => {
    const hasNewResult =
      booking.availability !== null &&
      booking.availability !== previousAvailabilityRef.current;

    previousAvailabilityRef.current = booking.availability;

    if (!hasNewResult || !availabilityRef.current) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    availabilityRef.current.scrollIntoView({
      behavior: prefersReducedMotion ? "instant" : "smooth",
      block: "start",
    });
  }, [booking.availability]);

  return (
    <div className="mh-booking">
      {booking.errorMessage && (
        <Alert className="mh-booking-alert" variant="danger" role="alert">
          {booking.errorMessage}
        </Alert>
      )}

      <BookingSearch booking={booking} />

      <div ref={availabilityRef} className="mh-booking-availability-anchor">
        <BookingAvailability
          booking={booking}
          isAuthenticated={Boolean(user)}
        />
      </div>

      <BookingConfirmationModal
        reservation={booking.confirmedReservation}
        onClose={booking.closeReservationConfirmation}
      />
    </div>
  );
}
