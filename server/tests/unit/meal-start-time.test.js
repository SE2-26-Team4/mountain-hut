import { describe, expect, it } from "vitest";

import {
  getBookingDeadline,
  getMealEndTimestamp,
  getMealStartTimestamp,
} from "../../services/booking-time.js";

// Staff bookings close at the start of the meal service.
// Hiker bookings two hours earlier.
describe("meal service start time", () => {
  it.each([
    ["winter time", "2026-11-11", "12:00", "2026-11-11T11:00:00.000Z"],
    ["summer time", "2026-07-04", "19:30", "2026-07-04T17:30:00.000Z"],
  ])("converts the Rome start time in %s", (_season, date, time, expected) => {
    expect(new Date(getMealStartTimestamp(date, time)).toISOString()).toBe(
      expected,
    );
  });

  it("places the hiker deadline two hours before the start", () => {
    expect(
      getMealStartTimestamp("2026-11-11", "12:00") -
        getBookingDeadline("2026-11-11", "12:00"),
    ).toBe(2 * 60 * 60 * 1000);
  });

  // [REQUIREMENT] MH-08: A hiker can cancel a confirmed booking.
  // The application accepts cancellations until the meal service ends.
  it("converts the Rome end time of a meal service", () => {
    expect(
      new Date(getMealEndTimestamp("2026-11-11", "14:00")).toISOString(),
    ).toBe("2026-11-11T13:00:00.000Z");
  });

  it("rejects a start time skipped by daylight saving time", () => {
    expect(() => getMealStartTimestamp("2026-03-29", "02:30")).toThrow(
      "The selected meal time is not valid in the hut time zone.",
    );
  });
});
