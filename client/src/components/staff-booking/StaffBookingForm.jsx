import { useEffect, useState } from "react";
import { Col, Form, Row } from "react-bootstrap";

import BookingAPI, { BookingApiError } from "../../API/booking-api.js";
import {
  bookingRequestsTooLong,
  emptyBookingRequests,
  toBookingRequestFields,
  dietaryRequirementsIncomplete,
} from "../../utils/booking-requirements.js";
import BookingConfirmationModal from "../booking/BookingConfirmationModal.jsx";
import ExistingHikerPicker from "./ExistingHikerPicker.jsx";
import NewHikerModal from "./NewHikerModal.jsx";
import StaffBookingDetails from "./StaffBookingDetails.jsx";
import TemporaryHikerFields from "./TemporaryHikerFields.jsx";

const hikerOptions = [
  ["existing", "Existing", "Find an existing hiker", "search"],
  ["new", "New", "Register a new hiker", "person-plus"],
  ["temporary", "Temporary", "Book without an account", "person"],
];

const hutClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** @param {{ onCancel: () => void }} props */
export default function StaffBookingForm({ onCancel }) {
  const [hikerMode, setHikerMode] = useState("existing");
  const [showNewHiker, setShowNewHiker] = useState(false);
  const [newHikerRegistration, setNewHikerRegistration] = useState(
    /** @type {{ hiker: import("../../models/models.js").HikerDTO, passwordSent: boolean } | null} */ (
      null
    ),
  );
  const [temporaryName, setTemporaryName] = useState("");
  const [temporaryLastName, setTemporaryLastName] = useState("");
  const [temporaryPhone, setTemporaryPhone] = useState("");
  const [temporaryEmail, setTemporaryEmail] = useState("");
  const [hikerSearch, setHikerSearch] = useState("");
  const [searchResults, setSearchResults] = useState(
    /** @type {import("../../models/models.js").HikerDTO[]} */ ([]),
  );
  const [selectedHiker, setSelectedHiker] = useState(
    /** @type {import("../../models/models.js").HikerDTO | null} */ (null),
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");

  const [bookingDate, setBookingDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [requests, setRequests] = useState(emptyBookingRequests);
  const [mealSlots, setMealSlots] = useState(
    /** @type {import("../../models/models.js").MealSlotDTO[]} */ ([]),
  );
  const [slotLoadError, setSlotLoadError] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingErrorCode, setBookingErrorCode] = useState(
    /** @type {string | undefined} */ (undefined),
  );
  // Free seats of the selected slot, and a counter to load them again.
  const [availability, setAvailability] = useState(
    /** @type {{ key: string, seats: number | null } | null} */ (null),
  );
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [confirmedReservation, setConfirmedReservation] = useState(
    /** @type {import("../booking/BookingConfirmationModal.jsx").BookingConfirmation | null} */ (
      null
    ),
  );

  /** @param {Exclude<import("../../models/models.js").StaffHikerInputDTO, { type: "existing" }>} hiker */
  const handleRegisterNewHiker = async (hiker) => {
    const result = await BookingAPI.createHiker(hiker);
    setNewHikerRegistration(result);
  };

  /** @param {import("../../models/models.js").HikerDTO} hiker */
  const handleContinueWithNewHiker = (hiker) => {
    setHikerMode("existing");
    setSelectedHiker(hiker);
    setHikerSearch("");
    setSearchResults([]);
    setSearchMessage("");
  };

  const handleHideNewHiker = () => {
    setShowNewHiker(false);
    setNewHikerRegistration(null);
  };

  useEffect(() => {
    let ignore = false;

    BookingAPI.getMealSlots()
      .then((slots) => {
        if (!ignore) setMealSlots(slots);
      })
      .catch(() => {
        if (!ignore) setSlotLoadError("Could not load meal slots.");
      })
      .finally(() => {
        if (!ignore) setLoadingSlots(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const availabilityKey = `${bookingDate}|${slotId}|${availabilityVersion}`;

  // Show staff the free seats before they confirm (same data as for hikers).
  useEffect(() => {
    if (!bookingDate || !slotId) return;

    let ignore = false;

    BookingAPI.getAvailability(bookingDate, Number(slotId))
      .then((result) => {
        if (!ignore) {
          setAvailability({
            key: availabilityKey,
            seats: result.totalAvailableSeats,
          });
        }
      })
      .catch(() => {
        if (!ignore) setAvailability({ key: availabilityKey, seats: null });
      });

    return () => {
      ignore = true;
    };
  }, [availabilityKey, bookingDate, slotId]);

  /** @type {import("./StaffBookingDetails.jsx").SeatAvailability} */
  let seatAvailability = { status: "idle" };

  if (bookingDate && slotId) {
    if (availability?.key !== availabilityKey) {
      seatAvailability = { status: "loading" };
    } else if (availability.seats === null) {
      seatAvailability = { status: "error" };
    } else {
      seatAvailability = { status: "ready", seats: availability.seats };
    }
  }

  const notEnoughSeats =
    seatAvailability.status === "ready" &&
    Number(partySize) > seatAvailability.seats;

  const parts = hutClock.formatToParts(new Date());

  /** @param {Intl.DateTimeFormatPartTypes} type */
  const hutPart = (type) => parts.find((part) => part.type === type)?.value;

  const hutToday = `${hutPart("year")}-${hutPart("month")}-${hutPart("day")}`;
  const hutTime = `${hutPart("hour")}:${hutPart("minute")}`;

  const slotsForDate = mealSlots
    .filter(
      (slot) =>
        slot.slotDate === bookingDate &&
        (slot.slotDate > hutToday ||
          (slot.slotDate === hutToday && slot.startTime > hutTime)),
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  /** @param {string} query - Trimmed search term. */
  const searchHikers = async (query) => {
    if (
      query.length < 2 ||
      query.length > 100 ||
      isSearching ||
      isSavingBooking
    ) {
      return;
    }

    setIsSearching(true);
    setSearchMessage("");
    setSearchResults([]);

    try {
      const hikers = await BookingAPI.searchHikers(query);
      setSearchResults(hikers);

      if (hikers.length === 0) {
        setSearchMessage("No hikers found. Try a different search.");
      }
    } catch (error) {
      setSearchMessage(
        error instanceof Error ? error.message : "Could not search for hikers.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleHikerSearch = () => searchHikers(hikerSearch.trim());

  // The email of a temporary hiker already belongs to a hiker: look them up.
  const handleFindHikerByEmail = () => {
    const email = temporaryEmail.trim();

    setBookingError("");
    setBookingErrorCode(undefined);
    setHikerMode("existing");
    setSelectedHiker(null);
    setHikerSearch(email);
    void searchHikers(email);
  };

  /** @param {import("react").FormEvent<HTMLFormElement>} event */
  const handleConfirmBooking = async (event) => {
    event.preventDefault();
    if (isSavingBooking || isSearching) return;

    setBookingError("");
    setBookingErrorCode(undefined);

    if (dietaryRequirementsIncomplete(requests, Number(partySize))) {
      setBookingError(
        "Answer the dietary requirements question and complete any required descriptions.",
      );
      return;
    }
    if (bookingRequestsTooLong(requests)) {
      setBookingError("Each field can contain up to 1,000 characters.");
      return;
    }

    /** @type {import("../../models/models.js").StaffHikerInputDTO} */
    let hiker;

    if (hikerMode === "existing" && selectedHiker) {
      hiker = { type: "existing", hikerId: selectedHiker.id };
    } else if (hikerMode === "temporary" && temporaryName.trim()) {
      hiker = {
        type: "temporary",
        fullName: [temporaryName.trim(), temporaryLastName.trim()]
          .filter(Boolean)
          .join(" "),
        phone: temporaryPhone.trim() || null,
      };
    } else {
      setBookingError("Select a hiker or enter a first name.");
      return;
    }

    const selectedSlot = slotsForDate.find(
      (slot) => String(slot.id) === slotId,
    );
    const guests = Number(partySize);

    if (!selectedSlot || !Number.isSafeInteger(guests) || guests < 1) {
      setBookingError(
        "Select a date and meal slot, and enter a valid party size.",
      );
      return;
    }

    if (notEnoughSeats) {
      setBookingError("There are not enough available seats.");
      return;
    }

    setIsSavingBooking(true);

    try {
      const result = await BookingAPI.createStaffBooking({
        hiker,
        confirmationEmail:
          hiker.type === "temporary"
            ? temporaryEmail.trim() || undefined
            : undefined,
        bookingDate,
        slotId: selectedSlot.id,
        partySize: guests,
        ...toBookingRequestFields(requests),
      });

      setConfirmedReservation({
        id: result.booking.id,
        bookingDate: result.booking.bookingDate,
        mealName: result.booking.slotName ?? selectedSlot.name,
        startTime: result.booking.slotStartTime ?? selectedSlot.startTime,
        endTime: result.booking.slotEndTime ?? selectedSlot.endTime,
        partySize: result.booking.partySize,
        dietaryRequirements: result.booking.dietaryRequirements,
        specialRequests: result.booking.specialRequests,
        emailSent: result.emailSent,
        emailRecipient: result.emailRecipient,
      });

      setHikerMode("existing");
      setSelectedHiker(null);
      setHikerSearch("");
      setSearchResults([]);
      setSearchMessage("");
      setTemporaryName("");
      setTemporaryLastName("");
      setTemporaryPhone("");
      setTemporaryEmail("");
      setBookingDate("");
      setSlotId("");
      setPartySize("1");
      setRequests(emptyBookingRequests());
    } catch (error) {
      setBookingError(
        error instanceof Error
          ? error.message
          : "Could not create the booking.",
      );
      setBookingErrorCode(
        error instanceof BookingApiError ? error.code : undefined,
      );
      // Seats may have changed since they were loaded.
      setAvailabilityVersion((version) => version + 1);
    } finally {
      setIsSavingBooking(false);
    }
  };

  return (
    <>
      <Form onSubmit={handleConfirmBooking}>
        <fieldset disabled={isSavingBooking}>
          <fieldset className="mt-4">
            <legend className="h5 mb-3">Select hiker</legend>

            <Row className="g-2">
              {hikerOptions.map(([value, label, description, icon]) => {
                const isSelected = showNewHiker
                  ? value === "new"
                  : hikerMode === value;

                const content = (
                  <>
                    {isSelected && (
                      <i
                        className="bi bi-check-circle-fill staff-hiker-option-check"
                        aria-hidden="true"
                      />
                    )}
                    <i
                      className={`bi bi-${icon} d-block mb-2`}
                      aria-hidden="true"
                    />
                    <strong className="d-block">{label}</strong>
                    <small>{description}</small>
                  </>
                );

                return (
                  <Col key={value} xs={12} md={4}>
                    {value === "new" ? (
                      <button
                        type="button"
                        className={`staff-hiker-option${isSelected ? " is-selected" : ""}`}
                        aria-haspopup="dialog"
                        aria-expanded={showNewHiker}
                        onClick={(event) => {
                          event.currentTarget.focus();
                          setShowNewHiker(true);
                        }}
                      >
                        {content}
                      </button>
                    ) : (
                      <>
                        <input
                          className="btn-check"
                          type="radio"
                          name="staff-hiker-mode"
                          id={`staff-hiker-${value}`}
                          checked={hikerMode === value}
                          onChange={() => setHikerMode(value)}
                        />
                        <label
                          className={`staff-hiker-option${isSelected ? " is-selected" : ""}`}
                          htmlFor={`staff-hiker-${value}`}
                        >
                          {content}
                        </label>
                      </>
                    )}
                  </Col>
                );
              })}
            </Row>
          </fieldset>

          {hikerMode === "existing" && (
            <ExistingHikerPicker
              selectedHiker={selectedHiker}
              searchResults={searchResults}
              hikerSearch={hikerSearch}
              isSearching={isSearching}
              searchMessage={searchMessage}
              onSearch={handleHikerSearch}
              onSelect={setSelectedHiker}
              onQueryChange={(value) => {
                setHikerSearch(value);
                setSearchResults([]);
                setSearchMessage("");
              }}
            />
          )}

          {hikerMode === "temporary" && (
            <TemporaryHikerFields
              temporaryName={temporaryName}
              temporaryLastName={temporaryLastName}
              temporaryPhone={temporaryPhone}
              temporaryEmail={temporaryEmail}
              setTemporaryName={setTemporaryName}
              setTemporaryLastName={setTemporaryLastName}
              setTemporaryPhone={setTemporaryPhone}
              setTemporaryEmail={setTemporaryEmail}
            />
          )}

          <StaffBookingDetails
            bookingDate={bookingDate}
            slotId={slotId}
            partySize={partySize}
            hutToday={hutToday}
            slotLoadError={slotLoadError}
            setBookingDate={setBookingDate}
            setSlotId={setSlotId}
            setPartySize={setPartySize}
            loadingSlots={loadingSlots}
            slotsForDate={slotsForDate}
            requests={requests}
            onRequestsChange={setRequests}
            isSavingBooking={isSavingBooking}
            seatAvailability={seatAvailability}
          />
        </fieldset>

        {bookingError && (
          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <p className="text-danger mb-0" role="alert">
              {bookingError}
            </p>

            {bookingErrorCode === "EMAIL_ALREADY_REGISTERED" &&
              hikerMode === "temporary" &&
              temporaryEmail.trim() && (
                <button
                  type="button"
                  className="cap-outline"
                  onClick={handleFindHikerByEmail}
                >
                  Find this hiker
                </button>
              )}
          </div>
        )}

        <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
          <button
            type="button"
            className="cap-outline"
            disabled={isSavingBooking}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="cap-primary"
            disabled={
              isSavingBooking ||
              isSearching ||
              !slotId ||
              notEnoughSeats ||
              (hikerMode === "existing" && !selectedHiker) ||
              (hikerMode === "temporary" && !temporaryName.trim())
            }
          >
            {isSavingBooking ? "Confirming…" : "Confirm booking"}
          </button>
        </div>
      </Form>

      <BookingConfirmationModal
        reservation={confirmedReservation}
        onClose={() => setConfirmedReservation(null)}
      />

      <NewHikerModal
        show={showNewHiker}
        onHide={handleHideNewHiker}
        registration={newHikerRegistration}
        onRegister={handleRegisterNewHiker}
        onContinue={handleContinueWithNewHiker}
      />
    </>
  );
}
