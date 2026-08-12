import 'server-only'

import { createId } from '@paralleldrive/cuid2'
import { Prisma } from '@prisma/client'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import {
  CONTACT_TYPES,
  DISPLAY_PAST_DAYS,
  addDateKeys,
  buildSlots,
  getLocalDateKey,
  getLocalMinutes,
  getOrCreateWakaBookingSettings,
  getOrCreateWakaBookingStudios,
  getScheduleForDate,
  isClosedDate,
  isActiveBooking,
  isWithinBookingWindow,
  parseDateKey,
  serializeBooking,
} from '~/server/booking/waka'
import { badRequest, conflict, serverError } from '~/hono/_lib/errors'
import { ok } from '~/hono/_lib/response'
import { db } from '~/server/lib/db'

const app = new Hono()

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeContactType(value: unknown) {
  const contactType = asString(value)
  return CONTACT_TYPES.includes(contactType as (typeof CONTACT_TYPES)[number]) ? contactType : ''
}

function getClientIp(c: { req: { header: (name: string) => string | undefined } }) {
  const forwardedFor = c.req.header('x-forwarded-for')
  const realIp = c.req.header('x-real-ip')
  return (forwardedFor?.split(',')[0]?.trim() || realIp?.trim() || 'unknown').slice(0, 64)
}

function getLocalDayRange() {
  const today = getLocalDateKey()
  const tomorrow = addDateKeys(today, 1) as string
  return {
    start: new Date(`${today}T00:00:00+08:00`),
    end: new Date(`${tomorrow}T00:00:00+08:00`),
  }
}

function getDateRange(fromValue?: string, toValue?: string) {
  const from = fromValue || getLocalDateKey()
  const to = toValue || addDateKeys(from, 30)
  if (!to || !parseDateKey(from) || !parseDateKey(to) || from > to) {
    throw badRequest('日期范围无效')
  }
  const today = getLocalDateKey()
  const firstDisplayDate = addDateKeys(today, -DISPLAY_PAST_DAYS)
  if (!firstDisplayDate || from < firstDisplayDate) {
    throw badRequest('最多只能查看过去 30 天的排班')
  }
  return { from, to }
}

async function assertBookableDate(date: string, bookingWindowDays: number) {
  if (!isWithinBookingWindow(date, bookingWindowDays)) {
    throw badRequest('只能预约未来 3 个月内的时间')
  }
}

app.get('/config', async (c) => {
  try {
    const settings = await getOrCreateWakaBookingSettings()
    const studios = await getOrCreateWakaBookingStudios()
    return ok(c, {
      bookingWindowDays: settings.bookingWindowDays,
      slotMinutes: settings.slotMinutes,
      schedules: settings.schedules.map((schedule) => ({
        weekday: schedule.weekday,
        enabled: schedule.enabled,
        openMinutes: schedule.openMinutes,
        closeMinutes: schedule.closeMinutes,
      })),
      closedDates: settings.closedDates.map((closedDate) => closedDate.date.toISOString().slice(0, 10)),
      studios: studios.filter((studio) => studio.enabled).map((studio) => ({ id: studio.id, name: studio.name })),
    })
  } catch (error) {
    throw serverError('Failed to fetch booking config', error)
  }
})

app.get('/availability', async (c) => {
  try {
    const settings = await getOrCreateWakaBookingSettings()
    const studios = await getOrCreateWakaBookingStudios()
    const studioId = asString(c.req.query('studioId'))
    if (!studioId || !studios.some((studio) => studio.id === studioId && studio.enabled)) {
      throw badRequest('请选择有效的棚子')
    }
    const { from, to } = getDateRange(c.req.query('from'), c.req.query('to'))
    const maxTo = addDateKeys(getLocalDateKey(), settings.bookingWindowDays)
    if (!maxTo || to > maxTo) {
      throw badRequest('查询范围不能超过可预约时间范围')
    }

    const fromDate = parseDateKey(from) as Date
    const toExclusive = parseDateKey(addDateKeys(to, 1) as string) as Date
    const bookings = await db.wakaBooking.findMany({
      where: {
        studioId,
        bookingDate: { gte: fromDate, lt: toExclusive },
        status: { in: ['pending', 'confirmed'] },
      },
      select: { bookingDate: true, startMinutes: true, endMinutes: true, customerName: true },
    })

    const bookedByDate = new Map<string, Array<{ startMinutes: number; endMinutes: number; customerName: string | null }>>()
    for (const booking of bookings) {
      const date = booking.bookingDate.toISOString().slice(0, 10)
      const ranges = bookedByDate.get(date) || []
      ranges.push({ startMinutes: booking.startMinutes, endMinutes: booking.endMinutes, customerName: booking.customerName })
      bookedByDate.set(date, ranges)
    }

    const today = getLocalDateKey()
    const currentMinutes = getLocalMinutes()
    const days = []
    for (let date = from; date <= to;) {
      const closed = isClosedDate(settings.closedDates, date)
      const schedule = closed ? null : getScheduleForDate(settings.schedules, date)
      const slots = schedule
        ? buildSlots(schedule, settings.slotMinutes, bookedByDate.get(date) || [], date === today ? currentMinutes : undefined)
        : []
      days.push({
        date,
        weekday: schedule?.weekday || null,
        enabled: Boolean(schedule?.enabled),
        slots: date < today ? slots.map((slot) => ({ ...slot, available: false })) : slots,
      })
      date = addDateKeys(date, 1) as string
    }

    return ok(c, { from, to, days })
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    throw serverError('Failed to fetch booking availability', error)
  }
})

app.post('/', async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>()
    const rawRanges = Array.isArray(body.selections) ? body.selections : [body]
    const ranges = rawRanges.map((value) => {
      const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
      return {
        date: asString(row.date),
        dateValue: parseDateKey(asString(row.date)),
        startMinutes: Number(row.startMinutes),
        endMinutes: Number(row.endMinutes),
      }
    })
    const contactType = normalizeContactType(body.contactType)
    const contactValue = asString(body.contactValue)
    const customerName = asString(body.customerName)
    const note = asString(body.note)
    const studioId = asString(body.studioId)
    const ipAddress = getClientIp(c)

    if (!ranges.length || ranges.length > 90 || !contactType || ranges.some((range) => !range.dateValue || !Number.isInteger(range.startMinutes) || !Number.isInteger(range.endMinutes))) {
      throw badRequest('预约信息不完整')
    }
    if (new Set(ranges.map((range) => range.date)).size !== ranges.length) {
      throw badRequest('同一天不能重复选择预约时段')
    }
    if (contactValue.length < 2 || contactValue.length > 120) {
      throw badRequest('请填写有效的联系方式')
    }
    if (!customerName) {
      throw badRequest('请填写称呼（CN）')
    }
    if (customerName.length > 80 || note.length > 1000) {
      throw badRequest('预约信息长度超出限制')
    }

    const settings = await getOrCreateWakaBookingSettings()
    const studios = await getOrCreateWakaBookingStudios()
    if (!studioId || !studios.some((studio) => studio.id === studioId && studio.enabled)) {
      throw badRequest('请选择有效的棚子')
    }
    const today = getLocalDateKey()
    const currentMinutes = getLocalMinutes()
    for (const range of ranges) {
      await assertBookableDate(range.date, settings.bookingWindowDays)
      if (range.date === today && range.startMinutes < currentMinutes) {
        throw badRequest('今天已开始的时间段不能预约，请选择后续时间')
      }
      if (isClosedDate(settings.closedDates, range.date)) {
        throw badRequest(`${range.date} 是休息日，暂不营业`)
      }
      const schedule = getScheduleForDate(settings.schedules, range.date)
      if (!schedule?.enabled) {
        throw badRequest(`${range.date} 暂不营业`)
      }
      if (
        range.startMinutes % settings.slotMinutes !== 0 ||
        range.endMinutes % settings.slotMinutes !== 0 ||
        range.endMinutes <= range.startMinutes ||
        range.startMinutes < schedule.openMinutes ||
        range.endMinutes > schedule.closeMinutes
      ) {
        throw badRequest(`${range.date} 的时间段不可预约`)
      }
    }

    const bookings = await db.$transaction(async (tx) => {
      const { start: todayStart, end: tomorrowStart } = getLocalDayRange()
      const sameDayBookingCount = await tx.wakaBooking.count({
        where: { ipAddress, createdAt: { gte: todayStart, lt: tomorrowStart } },
      })
      if (sameDayBookingCount >= 10) {
        throw conflict('这个 IP 今天已经预约过了，请联系管理员：13634085297')
      }
      const createdBookings = []
      for (const range of ranges) {
        const overlapping = await tx.wakaBooking.findFirst({
          where: {
            studioId,
            bookingDate: range.dateValue as Date,
            status: { in: ['pending', 'confirmed'] },
            startMinutes: { lt: range.endMinutes },
            endMinutes: { gt: range.startMinutes },
          },
        })
        if (overlapping) {
          throw conflict(`${range.date} 的时间段与已有预约重叠，请重新选择`)
        }
        createdBookings.push(await tx.wakaBooking.create({
          data: {
            id: createId(),
            studioId,
            bookingDate: range.dateValue as Date,
            startMinutes: range.startMinutes,
            endMinutes: range.endMinutes,
            contactType,
            contactValue,
            ipAddress,
            customerName: customerName || null,
            note: note || null,
            status: 'pending',
          },
          include: { studio: { select: { name: true } } },
        }))
      }
      return createdBookings
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return ok(c, bookings.length === 1 ? serializeBooking(bookings[0]) : bookings.map(serializeBooking))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      throw conflict('该时间段刚刚被预约，请重新选择')
    }
    if (error instanceof HTTPException) {
      throw error
    }
    throw serverError('Failed to create booking', error)
  }
})

app.get('/history', async (c) => {
  try {
    const contactType = normalizeContactType(c.req.query('contactType'))
    const contactValue = asString(c.req.query('contactValue'))
    if (!contactType || contactValue.length < 2) {
      throw badRequest('请输入预约时使用的联系方式')
    }

    const bookings = await db.wakaBooking.findMany({
      where: { contactType, contactValue },
      orderBy: [{ bookingDate: 'desc' }, { startMinutes: 'desc' }],
      include: { studio: { select: { name: true } } },
    })
    return ok(c, bookings.filter((booking) => isActiveBooking(booking.status) || booking.status === 'rejected' || booking.status === 'cancelled').map(serializeBooking))
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    throw serverError('Failed to fetch booking history', error)
  }
})

export default app
