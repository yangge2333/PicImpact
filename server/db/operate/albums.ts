// 相册表

'use server'

import { db } from '~/server/lib/db'
import { revalidateAlbumsCache } from '~/server/lib/cache'
import type { AlbumType } from '~/types'

type AlbumTx = Pick<typeof db, 'albums'>

function makeDeletedAlbumValue(albumValue: string, albumId: string) {
  const normalized = albumValue === '/' ? '/home' : albumValue.replace(/\/+$/, '') || '/album'
  return `${normalized}__deleted_${albumId}`
}

async function freeDeletedAlbumValue(tx: AlbumTx, albumValue: string, excludeId?: string) {
  const deletedAlbums = await tx.albums.findMany({
    where: {
      album_value: albumValue,
      del: 1,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      album_value: true,
    },
  })

  for (const deletedAlbum of deletedAlbums) {
    await tx.albums.update({
      where: {
        id: deletedAlbum.id,
      },
      data: {
        album_value: makeDeletedAlbumValue(deletedAlbum.album_value, deletedAlbum.id),
        updatedAt: new Date(),
      },
    })
  }
}

async function assertActiveAlbumValueAvailable(tx: AlbumTx, albumValue: string, excludeId?: string) {
  const activeAlbum = await tx.albums.findFirst({
    where: {
      album_value: albumValue,
      del: 0,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
    },
  })

  if (activeAlbum) {
    throw new Error('Album route already exists')
  }
}

/**
 * 新增相册
 * @param album 相册数据
 */
export async function insertAlbums(album: AlbumType) {
  if (!album.sort || album.sort < 0) {
    album.sort = 0
  }
  const result = await db.$transaction(async (tx) => {
    await assertActiveAlbumValueAvailable(tx, album.album_value)
    await freeDeletedAlbumValue(tx, album.album_value)

    return await tx.albums.create({
      data: {
        name: album.name,
        album_value: album.album_value,
        detail: album.detail,
        sort: album.sort,
        theme: album.theme,
        show: album.show,
        license: album.license,
        del: 0,
        image_sorting: album.image_sorting,
        random_show: album.random_show,
      }
    })
  })
  revalidateAlbumsCache()
  return result
}

/**
 * 逻辑删除相册
 * @param id 相册 ID
 */
export async function deleteAlbum(id: string) {
  const result = await db.$transaction(async (tx) => {
    const album = await tx.albums.findFirst({
      where: {
        id,
      },
      select: {
        id: true,
        album_value: true,
      },
    })
    if (!album) {
      throw new Error('Album does not exist')
    }

    return await tx.albums.update({
      where: {
        id: id
      },
      data: {
        album_value: makeDeletedAlbumValue(album.album_value, album.id),
        del: 1,
        updatedAt: new Date(),
      }
    })
  })
  revalidateAlbumsCache()
  return result
}

/**
 * 更新相册
 * @param album 相册数据
 */
export async function updateAlbum(album: AlbumType) {
  if (!album.sort || album.sort < 0) {
    album.sort = 0
  }
  await db.$transaction(async (tx) => {
    const tagOld = await tx.albums.findFirst({
      where: {
        id: album.id
      }
    })
    if (!tagOld) {
      throw new Error('标签不存在！')
    }
    await assertActiveAlbumValueAvailable(tx, album.album_value, album.id)
    await freeDeletedAlbumValue(tx, album.album_value, album.id)
    await tx.albums.update({
      where: {
        id: album.id
      },
      data: {
        name: album.name,
        album_value: album.album_value,
        detail: album.detail,
        sort: album.sort,
        theme: album.theme,
        show: album.show,
        license: album.license,
        updatedAt: new Date(),
        image_sorting: album.image_sorting,
        random_show: album.random_show,
      }
    })
    await tx.imagesAlbumsRelation.updateMany({
      where: {
        album_value: tagOld.album_value
      },
      data: {
        album_value: album.album_value
      }
    })
  })
  revalidateAlbumsCache()
}

/**
 * 更新相册是否显示
 * @param id 相册 ID
 * @param show 显示状态：0=显示，1=隐藏
 */
export async function updateAlbumShow(id: string, show: number) {
  const result = await db.albums.update({
    where: {
      id: id
    },
    data: {
      show: show,
      updatedAt: new Date()
    }
  })
  revalidateAlbumsCache()
  return result
}
