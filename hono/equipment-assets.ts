import 'server-only'

import { Prisma } from '@prisma/client'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
  badRequest,
  conflict,
  notFound,
  serverError,
} from '~/hono/_lib/errors'
import { ok, okEmpty } from '~/hono/_lib/response'
import {
  fetchEquipmentAssetCategories,
  fetchEquipmentAssets,
} from '~/server/db/query/equipment-assets'
import {
  createEquipmentAsset,
  createEquipmentAssetCategory,
  deleteEquipmentAsset,
  deleteEquipmentAssetCategory,
  moveEquipmentAsset,
  updateEquipmentAsset,
  updateEquipmentAssetCategory,
  type EquipmentAssetData,
} from '~/server/db/operate/equipment-assets'

const app = new Hono()
const validStatuses = new Set([
  'available',
  'in_use',
  'maintenance',
  'retired',
])

function cleanText(value: unknown, maxLength: number, required = false) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) throw badRequest('必填字段不能为空')
  if (text.length > maxLength)
    throw badRequest(`字段长度不能超过 ${maxLength}`)
  return text || null
}

function parseAssetBody(body: Record<string, unknown>): EquipmentAssetData {
  const assetNumber = cleanText(body.assetNumber, 100, true) as string
  const name = cleanText(body.name, 200, true) as string
  const categoryId = cleanText(body.categoryId, 50, true) as string
  const status = cleanText(body.status, 30, true) as string
  if (!validStatuses.has(status)) throw badRequest('资产状态无效')

  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls
        .filter(
          (item): item is string =>
            typeof item === 'string' && item.trim() !== '',
        )
        .slice(0, 6)
    : []
  const purchasePrice =
    body.purchasePrice === null ||
    body.purchasePrice === '' ||
    body.purchasePrice === undefined
      ? null
      : Number(body.purchasePrice)
  if (
    purchasePrice !== null &&
    (!Number.isFinite(purchasePrice) || purchasePrice < 0)
  ) {
    throw badRequest('采购价格无效')
  }

  let purchaseDate: Date | null = null
  if (typeof body.purchaseDate === 'string' && body.purchaseDate) {
    purchaseDate = new Date(`${body.purchaseDate}T00:00:00.000Z`)
    if (Number.isNaN(purchaseDate.getTime())) throw badRequest('采购日期无效')
  }

  return {
    assetNumber,
    name,
    categoryId,
    status,
    brand: cleanText(body.brand, 100),
    model: cleanText(body.model, 100),
    serialNumber: cleanText(body.serialNumber, 100),
    purchaseDate,
    purchasePrice,
    storageLocation: cleanText(body.storageLocation, 200),
    custodian: cleanText(body.custodian, 100),
    notes: cleanText(body.notes, 2000),
    imageUrls,
  }
}

function serializeAsset<
  T extends {
    purchasePrice: Prisma.Decimal | null;
    purchaseDate: Date | null;
    imageUrls: Prisma.JsonValue;
  },
>(item: T) {
  return {
    ...item,
    purchasePrice:
      item.purchasePrice === null ? null : Number(item.purchasePrice),
    purchaseDate: item.purchaseDate?.toISOString().slice(0, 10) || null,
    imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls : [],
  }
}

function handleMutationError(error: unknown): never {
  if (error instanceof HTTPException) throw error
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002')
      throw conflict('资产编号或分类名称已存在', error)
    if (error.code === 'P2025') throw notFound('记录不存在')
    if (error.code === 'P2003')
      throw conflict('分类正在使用中，无法删除', error)
  }
  if (error instanceof Error && error.message === 'CATEGORY_IN_USE') {
    throw conflict('分类正在使用中，无法删除', error)
  }
  throw serverError('保存失败', error)
}

app.get('/categories', async (c) => {
  try {
    const rows = await fetchEquipmentAssetCategories()
    return ok(
      c,
      rows.map((row) => ({
      id: row.id,
      name: row.name,
      sort: row.sort,
      assetCount: row._count.assets,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    )
  } catch (error) {
    throw serverError('分类加载失败', error)
  }
})

app.post('/categories', async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>()
    const name = cleanText(body.name, 100, true) as string
    return ok(c, await createEquipmentAssetCategory(name))
  } catch (error) {
    handleMutationError(error)
  }
})

app.put('/categories/:id', async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>()
    const name = cleanText(body.name, 100, true) as string
    return ok(c, await updateEquipmentAssetCategory(c.req.param('id'), name))
  } catch (error) {
    handleMutationError(error)
  }
})

app.delete('/categories/:id', async (c) => {
  try {
    await deleteEquipmentAssetCategory(c.req.param('id'))
    return okEmpty(c)
  } catch (error) {
    handleMutationError(error)
  }
})

app.get('/', async (c) => {
  try {
    const result = await fetchEquipmentAssets({
      keyword: c.req.query('keyword'),
      categoryId: c.req.query('categoryId'),
      status: c.req.query('status'),
      page: Number(c.req.query('page')) || 1,
      pageSize: Number(c.req.query('pageSize')) || 20,
    })
    return ok(c, { ...result, items: result.items.map(serializeAsset) })
  } catch (error) {
    throw serverError('资产列表加载失败', error)
  }
})

app.post('/', async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>()
    return ok(
      c,
      serializeAsset(await createEquipmentAsset(parseAssetBody(body))),
    )
  } catch (error) {
    handleMutationError(error)
  }
})

app.patch('/:id/order', async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>()
    const direction = body.direction
    if (direction !== 'up' && direction !== 'down') {
      throw badRequest('排序方向无效')
    }
    return ok(
      c,
      await moveEquipmentAsset(c.req.param('id'), direction),
    )
  } catch (error) {
    handleMutationError(error)
  }
})

app.put('/:id', async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>()
    return ok(
      c,
      serializeAsset(
        await updateEquipmentAsset(c.req.param('id'), parseAssetBody(body)),
      ),
    )
  } catch (error) {
    handleMutationError(error)
  }
})

app.delete('/:id', async (c) => {
  try {
    await deleteEquipmentAsset(c.req.param('id'))
    return okEmpty(c)
  } catch (error) {
    handleMutationError(error)
  }
})

export default app
