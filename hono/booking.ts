import 'server-only'

import { Hono } from 'hono'

import { badRequest, conflict, notFound, serverError } from '~/hono/_lib/errors'
import { requireAuth } from '~/hono/_lib/context'
import { ok } from '~/hono/_lib/response'
import {
  BOOKING_STATUSES,
  addDateKeys,
  getLocalDateKey,
  getOrCreateWakaBookingSettings,
  parseDateKey,
  serializeBooking,
} from '~/server/booking/waka'
import { db } from '~/server/lib/db'

const app = new Hono()
app.use('*', requireAuth)

function parseRange(fromValue?: string, toValue?: string) {
  const from = fromValue || getLocalDateKey()
  const to = toValue || addDateKeys(from, 30)
  if (!to || !parseDateKey(from) || !parseDateKey(to) || from > to) {
    throw badRequest('日期范围无效')
  }
  const maxTo = addDateKeys(from, 366)
  if (!maxTo || to > maxTo) {
    throw badRequest('查询范围不能超过一年')
  }
  return { from, to }
}

function asStatus(value: unknown) {
  const status = typeof value === 'string' ? value : ''
  return BOOKING_STATUSES.includes(status as (typeof BOOKING_STATUSES)[number]) ? status : ''
}

function validateScheduleInput(value: unknown) {
  if (!Array.isArray(value) || value.length !== 7) {
    throw badRequest('请完整配置一周的营业时间')
  }

  const weekdays = new Set<number>()
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw badRequest('营业时间配置无效')
    }
    const row = item as Record<string, unknown>
    const weekday = Number(row.weekday)
    const enabled = Boolean(row.enabled)
    const openMinutes = Number(row.openMinutes)
    const closeMinutes = Number(row.closeMinutes)
    if (
      !Number.isInteger(weekday) ||
      weekday < 1 ||
      weekday > 7 ||
      weekdays.has(weekday) ||
      !Number.isInteger(openMinutes) ||
      !Number.isInteger(closeMinutes) ||
      openMinutes < 0 ||
      closeMinutes > 1440 ||
      closeMinutes <= openMinutes ||
      openMinutes % 30 !== 0 ||
      closeMinutes % 30 !== 0
    ) {
      throw badRequest('营业时间必须是半小时的整数倍')
    }
    weekdays.add(weekday)
    return { weekday, enabled, openMinutes, closeMinutes }
  })
}

app.get('/settings', async (c) => {
  try {
    const settings = await getOrCreateWakaBookingSettings()
    return ok(c, {
      bookingWindowDays: settings.bookingWindowDays,
      slotMinutes: settings.slotMinutes,
      schedules: settings.schedules,
    })
  } catch (error) {
    throw serverError('Failed to fetch booking settings', error)
  }
})

app.put('/settings', async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>()
    const bookingWindowDays = Number(body.bookingWindowDays)
    if (!Number.isInteger(bookingWindowDays) || bookingWindowDays < 1 || bookingWindowDays > 90) {
      throw badRequest('可预约天数必须在 1 到 90 天之间')
    }
    const schedules = validateScheduleInput(body.schedules)
    const settings = await getOrCreateWakaBookingSettings()
    const updated = await db.$transaction(async (tx) => {
      await tx.wakaBookingSettings.update({
        where: { id: settings.id },
        data: { bookingWindowDays },
      })
      for (const schedule of schedules) {
        await tx.wakaBookingSchedule.update({
          where: { settingsId_weekday: { settingsId: settings.id, weekday: schedule.weekday } },
          data: schedule,
        })
      }
      return tx.wakaBookingSettings.findUniqueOrThrow({
        where: { id: settings.id },
        include: { schedules: { orderBy: { weekday: 'asc' } } },
      })
    })
    return ok(c, updated)
  } catch (error) {
    if (error instanceof Error && error.name === 'HTTPException') {
      throw error
    }
    throw serverError('Failed to update booking settings', error)
  }
})

app.get('/reservations', async (c) => {
  try {
    const { from, to } = parseRange(c.req.query('from'), c.req.query('to'))
    const status = asStatus(c.req.query('status'))
    const bookings = await db.wakaBooking.findMany({
      where: {
        bookingDate: {
          gte: parseDateKey(from) as Date,
          lt: parseDateKey(addDateKeys(to, 1) as string) as Date,
        },
        ...(status ? { status } : {}),
      },
      orderBy: [{ bookingDate: 'asc' }, { startMinutes: 'asc' }],
    })
    return ok(c, bookings.map(serializeBooking))
  } catch (error) {
    if (error instanceof Error && error.name === 'HTTPException') {
      throw error
    }
    throw serverError('Failed to fetch reservations', error)
  }
})

app.patch('/reservations/:id/status', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json<Record<string, unknown>>()
    const status = asStatus(body.status)
    const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim() : ''
    if (!id || !['confirmed', 'rejected', 'cancelled'].includes(status)) {
      throw badRequest('预约状态无效')
    }
    if (adminNote.length > 1000) {
      throw badRequest('备注长度超出限制')
    }

    const existing = await db.wakaBooking.findUnique({ where: { id } })
    if (!existing) {
      throw notFound('预约不存在')
    }
    if (!['pending', 'confirmed'].includes(existing.status)) {
      throw conflict('已结束的预约不能再次操作')
    }

    const booking = await db.wakaBooking.update({
      where: { id },
      data: {
        status,
        adminNote: adminNote || null,
        confirmedAt: status === 'confirmed' ? new Date() : null,
      },
    })
    return ok(c, serializeBooking(booking))
  } catch (error) {
    if (error instanceof Error && error.name === 'HTTPException') {
      throw error
    }
    throw serverError('Failed to update reservation status', error)
  }
})

export default app
