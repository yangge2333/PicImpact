import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'

const db = new PrismaClient()
const LIMIT = Number(process.env.PREVIEW_REGENERATE_LIMIT || 10)
const SHORT_SIDE = Number(process.env.PREVIEW_SHORT_SIDE || 2160)
const QUALITY = Number(process.env.PREVIEW_QUALITY || 80)

type ConfigMap = Record<string, string>
type StorageTarget = {
  storage: 's3' | 'r2'
  key: string
  bucket: string
  client: S3Client
}

function cfg(configs: ConfigMap, key: string) {
  return configs[key] || ''
}

function cleanBase(value: string) {
  return value.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function stripBase(url: string, base: string) {
  const clean = cleanBase(base)
  const parsed = new URL(url)
  const normalized = `${parsed.hostname}${parsed.pathname}`.replace(/\/+$/, '')
  if (clean && normalized.startsWith(`${clean}/`)) {
    return normalized.slice(clean.length + 1)
  }
  return parsed.pathname.replace(/^\/+/, '')
}

function getS3Client(configs: ConfigMap) {
  return new S3Client({
    region: cfg(configs, 'region'),
    endpoint: `https://${cleanBase(cfg(configs, 'endpoint'))}`,
    forcePathStyle: cfg(configs, 'force_path_style') === 'true',
    credentials: {
      accessKeyId: cfg(configs, 'accesskey_id'),
      secretAccessKey: cfg(configs, 'accesskey_secret'),
    },
  })
}

function getR2Client(configs: ConfigMap) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${cfg(configs, 'r2_account_id')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg(configs, 'r2_accesskey_id'),
      secretAccessKey: cfg(configs, 'r2_accesskey_secret'),
    },
  })
}

function resolveTarget(previewUrl: string, configs: ConfigMap): StorageTarget {
  const r2Domain = cfg(configs, 'r2_public_domain')
  if (r2Domain && previewUrl.startsWith(r2Domain)) {
    return {
      storage: 'r2',
      key: stripBase(previewUrl, r2Domain),
      bucket: cfg(configs, 'r2_bucket'),
      client: getR2Client(configs),
    }
  }

  const s3CdnUrl = cfg(configs, 's3_cdn_url')
  const bucket = cfg(configs, 'bucket')
  const endpoint = cleanBase(cfg(configs, 'endpoint'))
  const parsed = new URL(previewUrl)
  let key = ''

  if (cfg(configs, 's3_cdn') === 'true' && s3CdnUrl && previewUrl.startsWith(`https://${cleanBase(s3CdnUrl)}`)) {
    key = stripBase(previewUrl, s3CdnUrl)
  } else if (parsed.hostname === endpoint && parsed.pathname.startsWith(`/${bucket}/`)) {
    key = parsed.pathname.slice(bucket.length + 2)
  } else {
    key = parsed.pathname.replace(/^\/+/, '')
  }

  return {
    storage: 's3',
    key,
    bucket,
    client: getS3Client(configs),
  }
}

async function readConfigs(): Promise<ConfigMap> {
  const rows = await db.configs.findMany()
  return Object.fromEntries(rows.map((row) => [row.config_key, row.config_value || '']))
}

async function syncPreviewConfig() {
  await db.$transaction([
    db.configs.upsert({
      where: { config_key: 'preview_max_width_limit' },
      update: { config_value: String(SHORT_SIDE), updatedAt: new Date() },
      create: { config_key: 'preview_max_width_limit', config_value: String(SHORT_SIDE), detail: '预览图短边像素限制' },
    }),
    db.configs.upsert({
      where: { config_key: 'preview_max_width_limit_switch' },
      update: { config_value: '1', updatedAt: new Date() },
      create: { config_key: 'preview_max_width_limit_switch', config_value: '1', detail: '预览图短边限制开关' },
    }),
    db.configs.upsert({
      where: { config_key: 'preview_quality' },
      update: { config_value: String(QUALITY / 100), updatedAt: new Date() },
      create: { config_key: 'preview_quality', config_value: String(QUALITY / 100), detail: '预览图压缩质量' },
    }),
  ])
}

async function fetchBuffer(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`download failed: ${response.status} ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function buildPreview(buffer: Buffer) {
  const metadata = await sharp(buffer).rotate().metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0
  const resize = width > height
    ? { height: SHORT_SIDE }
    : { width: SHORT_SIDE }

  return sharp(buffer)
    .rotate()
    .resize({ ...resize, fit: 'inside', withoutEnlargement: false })
    .webp({ quality: QUALITY })
    .toBuffer()
}

async function main() {
  await syncPreviewConfig()
  const configs = await readConfigs()
  const images = await db.images.findMany({
    where: {
      del: 0,
      url: { not: null },
      preview_url: { not: null },
    },
    orderBy: [
      { createdAt: 'desc' },
      { updatedAt: 'desc' },
    ],
    take: LIMIT,
  })

  for (const image of images) {
    if (!image.url || !image.preview_url) continue
    const target = resolveTarget(image.preview_url, configs)
    const original = await fetchBuffer(image.url)
    const preview = await buildPreview(original)
    await target.client.send(new PutObjectCommand({
      Bucket: target.bucket,
      Key: target.key,
      Body: preview,
      ContentType: 'image/webp',
    }))
    console.info(`regenerated preview: ${image.id} ${target.storage}/${target.key}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
