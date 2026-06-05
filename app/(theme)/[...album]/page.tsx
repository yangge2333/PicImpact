import { getImagesData, getImagesPageTotal, getAlbumDisplayConfig } from '~/server/actions/images'
import type { ImageHandleProps } from '~/types/props'
import DefaultGallery from '~/components/layout/theme/default/default-gallery'
import { cachedAlbumByRouter } from '~/server/lib/cache'
import 'react-photo-album/masonry.css'
import type { AlbumType } from '~/types'
import SimpleGallery from '~/components/layout/theme/simple/simple-gallery'
import PolaroidGallery from '~/components/layout/theme/polaroid/polaroid-gallery'

export default async function Page({
  params
}: {
  params: Promise<{ album: string }>
}) {
  const { album } = await params

  const data: AlbumType = await cachedAlbumByRouter(`/${album}`)

  // Server-side data for the LCP preload hint: the album's first image and the
  // variant CDN base. Best-effort — a failure here must never break the page.
  const props: ImageHandleProps = {
    handle: getImagesData,
    args: 'getImages-client',
    album: `/${album}`,
    totalHandle: getImagesPageTotal,
    configHandle: getAlbumDisplayConfig,
    // Server-resolved so the gallery serves AVIF on the first render (no
    // preview double-load while the client config SWR is still pending).
  }

  if (!data) {
    return <DefaultGallery {...props} />
  }

  return (
    data.theme === '1' ? <SimpleGallery {...props} />
      : data.theme === '2' ? <PolaroidGallery {...props} />
      : <DefaultGallery {...props} />
  )
}
