import { unstable_cache, revalidateTag } from 'next/cache'

import { fetchClientImagesListByAlbum, fetchClientImagesPageTotalByAlbum } from '~/server/db/query/images'
import { fetchDailyImagesList, fetchDailyImagesPageTotal } from '~/server/db/query/daily'
import { fetchAlbumsShow, fetchAlbumByRouter } from '~/server/db/query/albums'
import { fetchConfigsByKeys, fetchConfigValue } from '~/server/db/query/configs'

export const CACHE_TAG = {
  gallery: 'public-gallery',
  albums: 'public-albums',
  config: 'public-config',
} as const

const REVALIDATE_SECONDS = 3600
const GALLERY_REVALIDATE_SECONDS = 60

export const cachedClientImagesListByAlbum = unstable_cache(
  (pageNum: number, album: string, camera?: string, lens?: string) =>
    fetchClientImagesListByAlbum(pageNum, album, camera, lens),
  ['public-client-images-list'],
  { tags: [CACHE_TAG.gallery], revalidate: GALLERY_REVALIDATE_SECONDS },
)

export const cachedClientImagesPageTotalByAlbum = unstable_cache(
  (album: string, camera?: string, lens?: string) =>
    fetchClientImagesPageTotalByAlbum(album, camera, lens),
  ['public-client-images-total'],
  { tags: [CACHE_TAG.gallery], revalidate: GALLERY_REVALIDATE_SECONDS },
)

export const cachedDailyImagesList = unstable_cache(
  (pageNum: number, camera?: string, lens?: string) =>
    fetchDailyImagesList(pageNum, camera, lens),
  ['public-daily-images-list'],
  { tags: [CACHE_TAG.gallery], revalidate: GALLERY_REVALIDATE_SECONDS },
)

export const cachedDailyImagesPageTotal = unstable_cache(
  (camera?: string, lens?: string) =>
    fetchDailyImagesPageTotal(camera, lens),
  ['public-daily-images-total'],
  { tags: [CACHE_TAG.gallery], revalidate: GALLERY_REVALIDATE_SECONDS },
)

export const cachedAlbumsShow = unstable_cache(
  () => fetchAlbumsShow(),
  ['public-albums-show'],
  { tags: [CACHE_TAG.albums], revalidate: REVALIDATE_SECONDS },
)

export const cachedAlbumByRouter = unstable_cache(
  (router: string) => fetchAlbumByRouter(router),
  ['public-album-by-router'],
  { tags: [CACHE_TAG.albums], revalidate: REVALIDATE_SECONDS },
)

export const cachedConfigsByKeys = unstable_cache(
  (keys: string[]) => fetchConfigsByKeys(keys),
  ['public-configs-by-keys'],
  { tags: [CACHE_TAG.config], revalidate: REVALIDATE_SECONDS },
)

export const cachedConfigValue = unstable_cache(
  (key: string, defaultValue: string = '') => fetchConfigValue(key, defaultValue),
  ['public-config-value'],
  { tags: [CACHE_TAG.config], revalidate: REVALIDATE_SECONDS },
)

export function revalidateGalleryCache() {
  revalidateTag(CACHE_TAG.gallery, 'max')
}

export function revalidateAlbumsCache() {
  revalidateTag(CACHE_TAG.albums, 'max')
  revalidateTag(CACHE_TAG.gallery, 'max')
}

export function revalidateConfigCache() {
  revalidateTag(CACHE_TAG.config, 'max')
  revalidateTag(CACHE_TAG.gallery, 'max')
}

export function revalidateAllPublicCaches() {
  revalidateTag(CACHE_TAG.gallery, 'max')
  revalidateTag(CACHE_TAG.albums, 'max')
  revalidateTag(CACHE_TAG.config, 'max')
}
