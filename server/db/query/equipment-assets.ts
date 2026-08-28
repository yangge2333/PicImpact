'use server'

import { db } from '~/server/lib/db'

export interface EquipmentAssetFilters {
  keyword?: string;
  categoryId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchEquipmentAssetCategories() {
  return db.equipmentAssetCategory.findMany({
    orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { assets: true } } },
  })
}

export async function fetchEquipmentAssets(filters: EquipmentAssetFilters) {
  const page = Math.max(1, filters.page || 1)
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20))
  const keyword = filters.keyword?.trim()
  const where = {
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(keyword
      ? {
          OR: [
            {
              assetNumber: { contains: keyword, mode: 'insensitive' as const },
            },
            { name: { contains: keyword, mode: 'insensitive' as const } },
            { brand: { contains: keyword, mode: 'insensitive' as const } },
            { model: { contains: keyword, mode: 'insensitive' as const } },
            {
              serialNumber: { contains: keyword, mode: 'insensitive' as const },
            },
            {
              storageLocation: {
                contains: keyword,
                mode: 'insensitive' as const,
              },
            },
            { custodian: { contains: keyword, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [items, total] = await db.$transaction([
    db.equipmentAsset.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.equipmentAsset.count({ where }),
  ])

  return { items, total, page, pageSize }
}
