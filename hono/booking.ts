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
  isClosedDate,
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

function validateClosedDates(value: unknown) {
  if (!Array.isArray(value) || value.length > 366) {
    throw badRequest('指定休息日配置无效')
  }
  const dates = value.map((item) => asString(item))
  if (dates.some((date) => !parseDateKey(date))) {
    throw badRequest('指定休息日日期无效')
  }
  return [...new Set(dates)].sort()
}

app.get('/settings', async (c) => {
  try {
    const settings = await getOrCreateWakaBookingSettings()
    return ok(c, {
      bookingWindowDays: settings.bookingWindowDays,
      slotMinutes: settings.slotMinutes,
      schedules: settings.schedules,
      closedDates: settings.closedDates.map((closedDate) => closedDate.date.toISOString().slice(0, 10)),
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
    const closedDates = body.closedDates === undefined ? null : validateClosedDates(body.closedDates)
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
      if (closedDates) {
        await tx.wakaBookingClosedDate.deleteMany({ where: { settingsId: settings.id } })
        if (closedDates.length > 0) {
          await tx.wakaBookingClosedDate.createMany({
            data: closedDates.map((date) => ({
              id: createId(),
              settingsId: settings.id,
              date: parseDateKey(date) as Date,
            })),
          })
        }
      }
      return tx.wakaBookingSettings.findUniqueOrThrow({
        where: { id: settings.id },
        include: {
          schedules: { orderBy: { weekday: 'asc' } },
          closedDates: { orderBy: { date: 'asc' } },
        },
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
    const rawSelections = Array.isArray(body.selections)
      ? body.selections
      : [{ date: body.fromDate || body.date, startMinutes: body.startMinutes, endMinutes: body.endMinutes }]
    const selections = rawSelections.map((value) => {
      const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
      const date = asString(row.date)
      return { date, dateValue: parseDateKey(date), startMinutes: Number(row.startMinutes), endMinutes: Number(row.endMinutes) }
    })
    const contactType = asContactType(body.contactType)
    const contactValue = asString(body.contactValue)
    const customerName = asString(body.customerName)
    const note = asString(body.note)

    if (!selections.length || selections.length > 90 || !contactType || selections.some((selection) => !selection.dateValue || !Number.isInteger(selection.startMinutes) || !Number.isInteger(selection.endMinutes))) {
      throw badRequest('预约信息不完整')
    }
    if (new Set(selections.map((selection) => `${selection.date}:${selection.startMinutes}:${selection.endMinutes}`)).size !== selections.length) {
      throw badRequest('预约明细不能重复')
    }
    if (contactValue.length < 2 || contactValue.length > 120 || customerName.length > 80 || note.length > 1000) {
      throw badRequest('预约信息长度或联系方式无效')
    }

    const settings = await getOrCreateWakaBookingSettings()
    for (const selection of selections) {
      if (isClosedDate(settings.closedDates, selection.date)) {
        throw badRequest(`${selection.date} 是休息日，不能添加预约`)
      }
      const schedule = getScheduleForDate(settings.schedules, selection.date)
      if (!schedule?.enabled) {
        throw badRequest(`${selection.date} 不营业`)
      }
      if (
        selection.startMinutes % settings.slotMinutes !== 0 ||
        selection.endMinutes % settings.slotMinutes !== 0 ||
        selection.endMinutes - selection.startMinutes < 120 ||
        selection.startMinutes < schedule.openMinutes ||
        selection.endMinutes > schedule.closeMinutes
      ) {
        throw badRequest(`${selection.date} 的时间段不可预约`)
      }
    }

    const bookings = await db.$transaction(async (tx) => {
      const createdBookings = []
      for (const selection of selections) {
        const bookingDate = selection.dateValue as Date
        const overlapping = await tx.wakaBooking.findFirst({
          where: {
            bookingDate,
            status: { in: ['pending', 'confirmed'] },
            startMinutes: { lt: selection.endMinutes },
            endMinutes: { gt: selection.startMinutes },
          },
        })
        if (overlapping) {
          throw conflict(`${selection.date} 的时间段与已有预约重叠，请重新选择`)
        }
        createdBookings.push(await tx.wakaBooking.create({
          data: {
            id: createId(),
            bookingDate,
            startMinutes: selection.startMinutes,
            endMinutes: selection.endMinutes,
            contactType,
            contactValue,
            customerName: customerName || null,
            note: note || null,
            status: 'pending',
          },
        }))
      }
      return createdBookings
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return ok(c, bookings.map(serializeBooking))
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

app.delete('/reservations/:id', async (c) => {
  try {
    const id = c.req.param('id')
    if (!id) {
      throw badRequest('预约编号无效')
    }

    const existing = await db.wakaBooking.findUnique({ where: { id } })
    if (!existing) {
      throw notFound('预约不存在')
    }
    await db.wakaBooking.delete({ where: { id } })
    return ok(c, { id })
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    throw serverError('Failed to delete reservation', error)
  }
})

export default app
