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
  return db.equipmentAsset.create({ data })
}

export async function updateEquipmentAsset(id: string, data: EquipmentAssetData) {
  return db.equipmentAsset.update({ where: { id }, data })
}

export async function deleteEquipmentAsset(id: string) {
  return db.equipmentAsset.delete({ where: { id } })
}
