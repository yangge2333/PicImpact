import { db } from '~/server/lib/db'

export const BOOKING_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled'] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const CONTACT_TYPES = ['phone', 'wechat', 'other'] as const
export type ContactType = (typeof CONTACT_TYPES)[number]

export const DEFAULT_BOOKING_WINDOW_DAYS = 90
export const DEFAULT_SLOT_MINUTES = 30
export const DEFAULT_OPEN_MINUTES = 9 * 60
export const DEFAULT_CLOSE_MINUTES = 18 * 60
export const LOCAL_TIME_ZONE = 'Asia/Shanghai'

export function getLocalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LOCAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null
  }

  return date
}

export function addDateKeys(value: string, days: number) {
  const date = parseDateKey(value)
  if (!date) {
    return null
  }

  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function getWeekday(value: string) {
  const date = parseDateKey(value)
  if (!date) {
    return null
  }

  const day = date.getUTCDay()
  return day === 0 ? 7 : day
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export function slotKey(date: string, startMinutes: number) {
  return `${date}:${String(startMinutes).padStart(4, '0')}`
}

export function isActiveBooking(status: string) {
  return status === 'pending' || status === 'confirmed'
}

export async function getOrCreateWakaBookingSettings() {
  const existing = await db.wakaBookingSettings.findFirst({
    include: { schedules: { orderBy: { weekday: 'asc' } } },
  })
  if (existing) {
    return existing
  }

  try {
    return await db.wakaBookingSettings.create({
      data: {
        id: 'waka-booking-default',
        bookingWindowDays: DEFAULT_BOOKING_WINDOW_DAYS,
        slotMinutes: DEFAULT_SLOT_MINUTES,
        schedules: {
          create: Array.from({ length: 7 }, (_, index) => ({
            id: `waka-booking-${index + 1}`,
            weekday: index + 1,
            enabled: true,
            openMinutes: DEFAULT_OPEN_MINUTES,
            closeMinutes: DEFAULT_CLOSE_MINUTES,
          })),
        },
      },
      include: { schedules: { orderBy: { weekday: 'asc' } } },
    })
  } catch (error) {
    const createdByOtherRequest = await db.wakaBookingSettings.findFirst({
      include: { schedules: { orderBy: { weekday: 'asc' } } },
    })
    if (createdByOtherRequest) {
      return createdByOtherRequest
    }
    throw error
  }
}

export function isWithinBookingWindow(date: string, bookingWindowDays: number) {
  const today = getLocalDateKey()
  const lastDate = addDateKeys(today, Math.max(bookingWindowDays - 1, 0))
  return Boolean(lastDate && date >= today && date <= lastDate)
}

export function getScheduleForDate(
  schedules: Array<{ weekday: number; enabled: boolean; openMinutes: number; closeMinutes: number }>,
  date: string,
) {
  const weekday = getWeekday(date)
  return schedules.find((schedule) => schedule.weekday === weekday) || null
}

export function buildSlots(
  schedule: { enabled: boolean; openMinutes: number; closeMinutes: number },
  slotMinutes: number,
  bookedStarts: Set<number>,
) {
  if (!schedule.enabled) {
    return []
  }

  const slots: Array<{ startMinutes: number; endMinutes: number; start: string; end: string; available: boolean }> = []
  for (
    let startMinutes = schedule.openMinutes;
    startMinutes + slotMinutes <= schedule.closeMinutes;
    startMinutes += slotMinutes
  ) {
    slots.push({
      startMinutes,
      endMinutes: startMinutes + slotMinutes,
      start: formatMinutes(startMinutes),
      end: formatMinutes(startMinutes + slotMinutes),
      available: !bookedStarts.has(startMinutes),
    })
  }
  return slots
}

export function serializeBooking(booking: {
  id: string
  bookingDate: Date
  startMinutes: number
  endMinutes: number
  contactType: string
  contactValue: string
  customerName: string | null
  note: string | null
  status: string
  adminNote: string | null
  confirmedAt: Date | null
  createdAt: Date
}) {
  return {
    id: booking.id,
    date: booking.bookingDate.toISOString().slice(0, 10),
    start: formatMinutes(booking.startMinutes),
    end: formatMinutes(booking.endMinutes),
    contactType: booking.contactType,
    contactValue: booking.contactValue,
    customerName: booking.customerName,
    note: booking.note,
    status: booking.status,
    adminNote: booking.adminNote,
    confirmedAt: booking.confirmedAt?.toISOString() || null,
    createdAt: booking.createdAt.toISOString(),
  }
}
