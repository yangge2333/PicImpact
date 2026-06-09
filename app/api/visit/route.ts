import { NextResponse } from 'next/server'

import { db } from '~/server/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_PATH_LENGTH = 500

function getClientIp(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null
  }

  return headers.get('x-real-ip') || headers.get('cf-connecting-ip')
}

function normalizePath(value: unknown) {
  if (typeof value !== 'string') {
    return '/'
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('/admin') || trimmed.startsWith('/api')) {
    return null
  }

  return trimmed.slice(0, MAX_PATH_LENGTH)
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    const body = contentType.includes('application/json')
      ? await request.json().catch(() => ({}))
      : {}
    const path = normalizePath((body as { path?: unknown }).path)

    if (!path) {
      return new NextResponse(null, { status: 204 })
    }

    await db.visitLog.create({
      data: {
        ip: getClientIp(request.headers),
        path,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
      },
    })
  } catch (error) {
    console.error('Failed to record visit', error)
  }

  return new NextResponse(null, { status: 204 })
}
