import 'server-only'
import { handle } from 'hono/vercel'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import route from '~/hono'
import download from '~/hono/open/download'
import images from '~/hono/open/images'
import cameraLens from '~/hono/open/camera-lens'
import wakaBooking from '~/hono/waka-booking'

const app = new Hono().basePath('/api')

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ code: error.status, message: error.message }, error.status)
  }
  console.error('Unexpected API error:', error)
  return c.json({ code: 500, message: 'Internal Server Error' }, 500)
})

app.route('/v1', route)
// 注意只有 /v1 开头是需要鉴权的
app.route('/public/download', download)
app.route('/public/images', images)
app.route('/public/camera-lens', cameraLens)
app.route('/waka/booking', wakaBooking)
app.notFound((c) => {
  return c.text('not found', 404)
})

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default app
