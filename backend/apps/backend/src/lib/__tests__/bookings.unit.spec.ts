import { BookingSettingsSchema, bookingIdFromToken, bookingToken, defaultBookingSettings, depositFor, feeOn, freeSlots, icsCalendar, icsEvent, localDate, payChoices, zonedToUtc } from "../bookings"

describe("bookings", () => {
  it("turns opening hours in the provider's time zone into UTC", () => {
    expect(zonedToUtc("2026-11-28", "11:30", "Africa/Lagos").toISOString()).toBe("2026-11-28T10:30:00.000Z")
    expect(zonedToUtc("2026-11-28", "09:00", "Africa/Accra").toISOString()).toBe("2026-11-28T09:00:00.000Z")
    expect(zonedToUtc("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z") // summer time
    expect(localDate(new Date("2026-11-27T23:30:00Z"), "Africa/Lagos")).toBe("2026-11-28")
  })

  it("offers free times inside opening hours, skipping taken ones, the buffer and short notice", () => {
    const s = { ...defaultBookingSettings("NG"), buffer_min: 15, min_notice_min: 120 }
    const now = Date.parse("2026-11-26T08:00:00Z") // Thu 09:00 in Lagos
    // Fri 27: 09:00–18:00 Lagos = 08:00–17:00 UTC; 60-minute service, every 30 minutes.
    const fri = freeSlots({ settings: s, duration_min: 60, date: "2026-11-27", busy: [], now })
    expect(fri[0]).toBe("2026-11-27T08:00:00.000Z")
    expect(fri[fri.length - 1]).toBe("2026-11-27T16:00:00.000Z")
    // A booking 10:00–11:00 (Lagos) blocks 09:30, 10:00, 10:30 and (with the 15-minute buffer) 11:00.
    const busy = [{ starts_at: "2026-11-27T09:00:00Z", ends_at: "2026-11-27T10:00:00Z", status: "confirmed" }]
    const withBusy = freeSlots({ settings: s, duration_min: 60, date: "2026-11-27", busy, now })
    expect(withBusy).not.toContain("2026-11-27T09:00:00.000Z")
    expect(withBusy).not.toContain("2026-11-27T08:30:00.000Z")
    expect(withBusy).not.toContain("2026-11-27T10:00:00.000Z")
    expect(withBusy).toContain("2026-11-27T10:30:00.000Z")
    // Sunday is closed; today needs 2 hours' notice (first slot 11:00 Lagos = 10:00 UTC).
    expect(freeSlots({ settings: s, duration_min: 60, date: "2026-11-29", busy: [], now })).toEqual([])
    expect(freeSlots({ settings: s, duration_min: 60, date: "2026-11-26", busy: [], now })[0]).toBe("2026-11-26T10:00:00.000Z")
    // Saturday: 10:00–16:00.
    expect(freeSlots({ settings: s, duration_min: 60, date: "2026-11-28", busy: [], now })[0]).toBe("2026-11-28T09:00:00.000Z")
    // A pending (unpaid) booking only holds the time for 30 minutes.
    const old = [{ ...busy[0], status: "pending", created_at: new Date(now - 31 * 60000).toISOString() }]
    expect(freeSlots({ settings: s, duration_min: 60, date: "2026-11-27", busy: old, now })).toContain("2026-11-27T09:00:00.000Z")
  })

  it("works out deposits, payment choices and AQUENORA's fee on top", () => {
    const svc = { id: "s", seller_id: "x", name: "Makeup", description: null, duration_min: 60, price: 45000, payment: "deposit" as const, deposit_type: "fixed" as const, deposit_value: 10000, active: true, sort: 0 }
    expect(depositFor(svc)).toBe(10000)
    expect(depositFor({ ...svc, deposit_type: "percent", deposit_value: 30 })).toBe(13500)
    expect(payChoices(svc, true)).toEqual(["deposit", "full"])
    expect(payChoices({ ...svc, payment: "none" }, true)).toEqual(["later", "full"])
    expect(payChoices({ ...svc, payment: "none" }, false)).toEqual(["later"])
    expect(payChoices(svc, false)).toEqual([])
    expect(feeOn(100000, 3)).toBe(3000)
  })

  it("signs booking links and writes calendar files", () => {
    const t = bookingToken("bkg_123")
    expect(bookingIdFromToken(t)).toBe("bkg_123")
    expect(bookingIdFromToken(t.slice(0, -1) + "x")).toBeNull()
    const ics = icsCalendar("Test", [icsEvent({ uid: "bkg_1", start: "2026-11-27T10:30:00Z", end: "2026-11-27T11:30:00Z", title: "Makeup, Glow; Ada", location: "Lekki" })])
    expect(ics).toContain("DTSTART:20261127T103000Z")
    expect(ics).toContain(String.raw`SUMMARY:Makeup\, Glow\; Ada`)
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true)
  })
  it("keeps blocked-off time free: daily lunch, repeating days, one-off and all-day blocks", () => {
    const now = Date.parse("2026-11-26T08:00:00Z")
    const base = { ...defaultBookingSettings("NG"), buffer_min: 0, min_notice_min: 0 }
    const lunch = { id: "b1", label: "Lunch", all_day: false, from: "13:00", to: "14:00", date: "2026-11-01", days: ["mon", "tue", "wed", "thu", "fri"] as const }
    const s = { ...base, blocks: [{ ...lunch, days: [...lunch.days] }] }
    const fri = freeSlots({ settings: s, duration_min: 60, date: "2026-11-27", busy: [], now })
    // 13:00 and 12:30 (would run into lunch) are gone; 12:00 (ends 13:00) and 14:00 are fine. Lagos = UTC+1.
    expect(fri).toContain("2026-11-27T11:00:00.000Z")
    expect(fri).not.toContain("2026-11-27T11:30:00.000Z")
    expect(fri).not.toContain("2026-11-27T12:00:00.000Z")
    expect(fri).toContain("2026-11-27T13:00:00.000Z")
    // Saturday isn't in the repeat days.
    expect(freeSlots({ settings: s, duration_min: 60, date: "2026-11-28", busy: [], now })).toContain("2026-11-28T12:00:00.000Z")
    // Ended repeats stop.
    const ended = { ...base, blocks: [{ ...lunch, days: [...lunch.days], end_date: "2026-11-20" }] }
    expect(freeSlots({ settings: ended, duration_min: 60, date: "2026-11-27", busy: [], now })).toContain("2026-11-27T12:00:00.000Z")
    // One-off: Friday 15:00–17:00 only; and an all-day holiday over several days.
    const once = { ...base, blocks: [{ id: "b2", label: "Dentist", all_day: false, from: "15:00", to: "17:00", date: "2026-11-27" }] }
    expect(freeSlots({ settings: once, duration_min: 60, date: "2026-11-27", busy: [], now })).not.toContain("2026-11-27T14:00:00.000Z")
    expect(freeSlots({ settings: once, duration_min: 60, date: "2026-12-04", busy: [], now })).toContain("2026-12-04T14:00:00.000Z")
    const holiday = { ...base, blocks: [{ id: "b3", label: "Christmas", all_day: true, from: "00:00", to: "23:59", date: "2026-12-24", end_date: "2026-12-26" }] }
    expect(freeSlots({ settings: holiday, duration_min: 60, date: "2026-12-24", busy: [], now })).toEqual([])
    expect(freeSlots({ settings: holiday, duration_min: 60, date: "2026-12-28", busy: [], now }).length).toBeGreaterThan(0)
    // Checked when saved.
    expect(BookingSettingsSchema.safeParse({ ...holiday, blocks: [{ ...holiday.blocks[0], end_date: "2026-12-01" }] }).success).toBe(false)
    expect(BookingSettingsSchema.safeParse(holiday).success).toBe(true)
  })
})
