import { Hono } from 'hono'

import { verifyAlipayNotification } from '~/server/payment/alipay'

const app = new Hono()

app.get('/', (c) => c.text('success'))

app.post('/', async (c) => {
  try {
    const contentType = c.req.header('content-type') || ''
    const body = contentType.includes('application/json')
      ? await c.req.json<Record<string, unknown>>()
      : await c.req.parseBody()
    const params: Record<string, string> = {}

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') {
        params[key] = value
      }
    }

    if (!verifyAlipayNotification(params)) {
      return c.text('fail', 400)
    }

    console.info('Alipay application gateway notification accepted', {
      appId: params.app_id,
      messageMethod: params.msg_method || null,
      messageType: params.msg_type || params.notify_type || null,
    })
    return c.text('success')
  } catch (error) {
    console.error('Alipay application gateway notification failed:', error instanceof Error ? error.message : error)
    return c.text('fail', 400)
  }
})

export default app
