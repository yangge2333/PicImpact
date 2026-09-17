'use server'

import { db } from '~/server/lib/db'

export interface EquipmentAssetData {
  assetNumber: string;
  name: string;
  categoryId: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  status: string;
  purchaseDate?: Date | null;
  purchasePrice?: number | null;
  storageLocation?: string | null;
  custodian?: string | null;
  notes?: string | null;
  imageUrls: string[];
}

export async function createEquipmentAssetCategory(name: string) {
  return db.equipmentAssetCategory.create({ data: { name } })
}

export async function updateEquipmentAssetCategory(id: string, name: string) {
  return db.equipmentAssetCategory.update({ where: { id }, data: { name } })
}

export async function deleteEquipmentAssetCategory(id: string) {
  const count = await db.equipmentAsset.count({ where: { categoryId: id } })
  if (count > 0) throw new Error('CATEGORY_IN_USE')
  return db.equipmentAssetCategory.delete({ where: { id } })
}

export async function createEquipmentAsset(data: EquipmentAssetData) {
  const maxSort = await db.equipmentAsset.aggregate({
    where: { categoryId: data.categoryId },
    _max: { sort: true },
  })
  return db.equipmentAsset.create({
    data: { ...data, sort: (maxSort._max.sort ?? -1) + 1 },
  })
}

export async function updateEquipmentAsset(id: string, data: EquipmentAssetData) {
  return db.equipmentAsset.update({ where: { id }, data })
}

export async function deleteEquipmentAsset(id: string) {
  return db.equipmentAsset.delete({ where: { id } })
}

export async function moveEquipmentAsset(
  id: string,
  direction: 'up' | 'down',
) {
  return db.$transaction(async (tx) => {
    const current = await tx.equipmentAsset.findUniqueOrThrow({
      where: { id },
      select: { id: true, categoryId: true },
    })
    const assets = await tx.equipmentAsset.findMany({
      where: { categoryId: current.categoryId },
      select: { id: true, sort: true },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
    })
    const currentIndex = assets.findIndex((asset) => asset.id === id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= assets.length) {
      return { moved: false }
    }

    const needsNormalization = assets.some((asset, index) => asset.sort !== index)
    if (needsNormalization) {
      for (const [index, asset] of assets.entries()) {
        await tx.equipmentAsset.update({
          where: { id: asset.id },
          data: { sort: index },
        })
      }
    }

    await tx.equipmentAsset.update({
      where: { id },
      data: { sort: targetIndex },
    })
    await tx.equipmentAsset.update({
      where: { id: assets[targetIndex].id },
      data: { sort: currentIndex },
    })
    return { moved: true }
  })
}
