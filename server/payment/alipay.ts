import 'server-only'

import { createSign, createVerify } from 'node:crypto'

const DEFAULT_DEPOSIT_CENTS = 10000
const DEFAULT_GATEWAY_URL = 'https://openapi.alipay.com/gateway.do'
const LOCAL_TIME_ZONE = 'Asia/Shanghai'

type AlipayConfig = {
  appId: string
  privateKey: string
  publicKey: string
  gatewayUrl: string
  returnUrl: string
  notifyUrl: string
}

export type AlipayPagePayment = {
  gateway: string
  params: Record<string, string>
  amountCents: number
  mode: 'page' | 'wap'
}

export type AlipayRefundRequest = {
  orderNo: string
  tradeNo?: string | null
  amountCents: number
  refundRequestNo: string
}

export type AlipayRefundResult = {
  refundFee: string
  refundedAt: string | null
  tradeNo: string | null
}

function normalizeKey(value: string | undefined) {
  return (value || '').trim().replace(/\\n/g, '\n')
}

function getPublicBaseUrl() {
  return (process.env.BETTER_AUTH_URL || '').trim().replace(/\/+$/, '')
}

function getAlipayConfig(): AlipayConfig {
  const appId = (process.env.ALIPAY_APP_ID || '').trim()
  const privateKey = normalizeKey(process.env.ALIPAY_PRIVATE_KEY)
  const publicKey = normalizeKey(process.env.ALIPAY_PUBLIC_KEY)
  const baseUrl = getPublicBaseUrl()
  const returnUrl = (process.env.ALIPAY_RETURN_URL || `${baseUrl}/waka/booking`).trim()
  const notifyUrl = (process.env.ALIPAY_NOTIFY_URL || `${baseUrl}/api/waka/booking/alipay/notify`).trim()

  if (!appId || !privateKey || !publicKey || !baseUrl || !returnUrl || !notifyUrl) {
    throw new Error('支付宝支付未配置完整，请设置 ALIPAY_APP_ID、ALIPAY_PRIVATE_KEY、ALIPAY_PUBLIC_KEY 和站点地址')
  }

  return {
    appId,
    privateKey,
    publicKey,
    gatewayUrl: (process.env.ALIPAY_GATEWAY_URL || DEFAULT_GATEWAY_URL).trim(),
    returnUrl,
    notifyUrl,
  }
}

export function assertAlipayConfigured() {
  getAlipayConfig()
}

export function getWakaBookingDepositCents() {
  const raw = (process.env.WAKA_BOOKING_DEPOSIT_CENTS || '').trim()
  if (!raw) return DEFAULT_DEPOSIT_CENTS

  const amount = Number(raw)
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('WAKA_BOOKING_DEPOSIT_CENTS 必须是正整数分')
  }
  return amount
}

function formatAmount(cents: number) {
  return (cents / 100).toFixed(2)
}

function formatTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LOCAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`
}

function buildSignContent(params: Record<string, string>) {
  return Object.keys(params)
    .filter((key) => key !== 'sign' && key !== 'sign_type' && params[key] !== '')
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&')
}

function sign(params: Record<string, string>, privateKey: string) {
  const signer = createSign('RSA-SHA256')
  signer.update(buildSignContent(params), 'utf8')
  return signer.sign(privateKey, 'base64')
}

function verify(params: Record<string, string>, signature: string, publicKey: string) {
  const verifier = createVerify('RSA-SHA256')
  verifier.update(buildSignContent(params), 'utf8')
  return verifier.verify(publicKey, signature, 'base64')
}

function appendOrderNo(url: string, orderNo: string) {
  const templateUrl = url.includes('{orderNo}') ? url.replace(/\{orderNo\}/g, encodeURIComponent(orderNo)) : url
  if (templateUrl !== url) return templateUrl
  return `${url}${url.includes('?') ? '&' : '?'}payment=return&orderNo=${encodeURIComponent(orderNo)}`
}

export function createAlipayPagePayment(orderNo: string, amountCents = getWakaBookingDepositCents(), mode: 'page' | 'wap' = 'page'): AlipayPagePayment {
  const config = getAlipayConfig()
  const isWap = mode === 'wap'
  const params: Record<string, string> = {
    app_id: config.appId,
    method: isWap ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay',
    format: 'JSON',
    return_url: appendOrderNo(config.returnUrl, orderNo),
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(),
    version: '1.0',
    notify_url: config.notifyUrl,
    biz_content: JSON.stringify({
      out_trade_no: orderNo,
      product_code: isWap ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY',
      total_amount: formatAmount(amountCents),
      subject: '哇咔印象预约定金',
      body: `哇咔印象预约定金（${orderNo}）`,
      timeout_express: '15m',
      ...(isWap ? { quit_url: appendOrderNo(config.returnUrl, orderNo) } : {}),
    }),
  }

  return {
    gateway: config.gatewayUrl,
    params: { ...params, sign: sign(params, config.privateKey) },
    amountCents,
    mode,
  }
}

export async function refundAlipayPayment(request: AlipayRefundRequest): Promise<AlipayRefundResult> {
  const config = getAlipayConfig()
  const bizContent: Record<string, string> = {
    refund_amount: formatAmount(request.amountCents),
    out_request_no: request.refundRequestNo,
    refund_reason: '预约被拒绝，自动退还定金',
  }
  if (request.tradeNo) {
    bizContent.trade_no = request.tradeNo
  } else {
    bizContent.out_trade_no = request.orderNo
  }

  const params: Record<string, string> = {
    app_id: config.appId,
    method: 'alipay.trade.refund',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  }
  const body = new URLSearchParams({ ...params, sign: sign(params, config.privateKey) })
  const response = await fetch(config.gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`支付宝退款网关返回 HTTP ${response.status}`)
  }

  const payload = await response.json() as { alipay_trade_refund_response?: Record<string, string> }
  const result = payload.alipay_trade_refund_response
  if (!result || result.code !== '10000') {
    throw new Error(`支付宝退款失败：${result?.sub_code || result?.msg || '未知错误'}`)
  }
  if (result.fund_change !== 'Y' || !amountMatchesCents(result.refund_fee, request.amountCents)) {
    throw new Error('支付宝退款结果金额异常')
  }

  return {
    refundFee: result.refund_fee,
    refundedAt: result.gmt_refund_pay || null,
    tradeNo: result.trade_no || null,
  }
}

export function verifyAlipayNotification(params: Record<string, string>) {
  const config = getAlipayConfig()
  const signature = params.sign
  return Boolean(signature && params.app_id === config.appId && verify(params, signature, config.publicKey))
}

export function amountMatchesCents(value: string | undefined, cents: number) {
  return typeof value === 'string' && Number(value).toFixed(2) === formatAmount(cents)
}
