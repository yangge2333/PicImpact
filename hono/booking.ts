import 'server-only'

import { createId } from '@paralleldrive/cuid2'
import { Prisma } from '@prisma/client'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { badRequest, conflict, notFound, serverError } from '~/hono/_lib/errors'
import { requireAuth } from '~/hono/_lib/context'
import { ok } from '~/hono/_lib/response'
import {
  BOOKING_STATUSES,
  CONTACT_TYPES,
  addDateKeys,
  getLocalDateKey,
  getOrCreateWakaBookingSettings,
  getScheduleForDate,
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

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asContactType(value: unknown) {
  const contactType = asString(value)
  return CONTACT_TYPES.includes(contactType as (typeof CONTACT_TYPES)[number]) ? contactType : ''
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
    if (error instanceof HTTPException) {
      throw error
    }
    throw serverError('Failed to update booking settings', error)
  }
})

app.post('/reservations', async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>()
    const date = asString(body.date)
    const dateValue = parseDateKey(date)
    const startMinutes = Number(body.startMinutes)
    const endMinutes = Number(body.endMinutes)
    const contactType = asContactType(body.contactType)
    const contactValue = asString(body.contactValue)
    const customerName = asString(body.customerName)
    const note = asString(body.note)

    if (!dateValue || !contactType || !Number.isInteger(startMinutes) || !Number.isInteger(endMinutes)) {
      throw badRequest('预约信息不完整')
    }
    if (contactValue.length < 2 || contactValue.length > 120 || customerName.length > 80 || note.length > 1000) {
      throw badRequest('预约信息长度或联系方式无效')
    }

    const settings = await getOrCreateWakaBookingSettings()
    const schedule = getScheduleForDate(settings.schedules, date)
    if (!schedule?.enabled) {
      throw badRequest('这一天暂不营业')
    }
    if (
      startMinutes % settings.slotMinutes !== 0 ||
      endMinutes % settings.slotMinutes !== 0 ||
      endMinutes <= startMinutes ||
      startMinutes < schedule.openMinutes ||
      endMinutes > schedule.closeMinutes
    ) {
      throw badRequest('该时间段不可预约')
    }

    const booking = await db.$transaction(async (tx) => {
      const overlapping = await tx.wakaBooking.findFirst({
        where: {
          bookingDate: dateValue,
          status: { in: ['pending', 'confirmed'] },
          startMinutes: { lt: endMinutes },
          endMinutes: { gt: startMinutes },
        },
      })
      if (overlapping) {
        throw conflict('所选时间段与已有预约重叠，请重新选择')
      }
      return tx.wakaBooking.create({
        data: {
          id: createId(),
          bookingDate: dateValue,
          startMinutes,
          endMinutes,
          contactType,
          contactValue,
          customerName: customerName || null,
          note: note || null,
          status: 'pending',
        },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return ok(c, serializeBooking(booking))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw conflict('所选时间段刚刚被占用，请重新选择')
    }
    if (error instanceof HTTPException) {
      throw error
    }
    throw serverError('Failed to create reservation', error)
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
    if (error instanceof HTTPException) {
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
    if (error instanceof HTTPException) {
      throw error
    }
    throw serverError('Failed to update reservation status', error)
  }
})

export default app
