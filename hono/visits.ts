import 'server-only'

import { Hono } from 'hono'

import { unauthorized, serverError } from '~/hono/_lib/errors'
import { ok } from '~/hono/_lib/response'
import { db } from '~/server/lib/db'

const app = new Hono()

const DEFAULT_DAYS = 30
const MAX_RANGE_DAYS = 366
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseDate(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback
  }

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? fallback : date
}

function formatDay(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

app.get('/', async (c) => {
  if (!c.get('session')) {
    throw unauthorized()
  }

  try {
    const now = startOfLocalDay(new Date())
    const defaultFrom = addDays(now, -(DEFAULT_DAYS - 1))
    const from = parseDate(c.req.query('from'), defaultFrom)
    let to = parseDate(c.req.query('to'), now)

    const maxTo = addDays(from, MAX_RANGE_DAYS - 1)
    if (to > maxTo) {
      to = maxTo
    }

    const toExclusive = addDays(to, 1)
    const page = Math.max(Number(c.req.query('page') || '1') || 1, 1)
    const pageSize = Math.min(
      Math.max(Number(c.req.query('pageSize') || DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    )
    const ip = c.req.query('ip')?.trim()

    const where = {
      createdAt: {
        gte: from,
        lt: toExclusive,
      },
      ...(ip
        ? {
            ip: {
              contains: ip,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    }

    const [total, records, allVisitsInRange] = await Promise.all([
      db.visitLog.count({ where }),
      db.visitLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          ip: true,
          path: true,
          userAgent: true,
          referer: true,
          createdAt: true,
        },
      }),
      db.visitLog.findMany({
        where,
        select: { createdAt: true },
      }),
    ])

    const counts = new Map<string, number>()
    for (const visit of allVisitsInRange) {
      const day = formatDay(visit.createdAt)
      counts.set(day, (counts.get(day) || 0) + 1)
    }

    const chart: { date: string; count: number }[] = []
    for (let date = new Date(from); date <= to; date = addDays(date, 1)) {
      const day = formatDay(date)
      chart.push({ date: day, count: counts.get(day) || 0 })
    }

    return ok(c, {
      chart,
      records,
      total,
      page,
      pageSize,
      from: formatDay(from),
      to: formatDay(to),
    })
  } catch (error) {
    throw serverError('Failed to fetch visit logs', error)
  }
})

export default app
