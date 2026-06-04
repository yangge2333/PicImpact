import type { ImageHandleProps } from '~/types/props'
import type { ImageType } from '~/types'
import { getImagesData, getImagesPageTotal, getDisplayConfig, initDailyIfNeeded } from '~/server/actions/images'
import { getVariantBaseUrl } from '~/server/lib/variant-storage'
import { cachedAlbumsShow } from '~/server/lib/cache'
import DefaultGallery from '~/components/layout/theme/default/default-gallery.tsx'
import GalleryPreloadHints from '~/components/gallery/gallery-preload-hints'
import { DEFAULT_GRID_SIZES } from '~/lib/image/grid-image-sizes'

export default async function Home() {
  await initDailyIfNeeded()

  // Server-side data for the LCP preload hint: the first gallery image and the
  // variant CDN base. Best-effort — a failure here must never break the page.
  const [firstPage, variantBaseUrl, albums] = await Promise.all([
    getImagesData(1, '/').catch(() => [] as ImageType[]),
    getVariantBaseUrl().catch(() => ''),
    cachedAlbumsShow().catch(() => []),
  ])

  const props: ImageHandleProps = {
    handle: getImagesData,
    args: 'getImages-client',
    album: '/',
    totalHandle: getImagesPageTotal,
    configHandle: getDisplayConfig,
    albums,
    // Server-resolved so the gallery serves AVIF on the first render (no
    // preview double-load while the client config SWR is still pending).
    variantBaseUrl,
  }

  return (
    <>
      <GalleryPreloadHints
        image={firstPage[0]}
        variantBaseUrl={variantBaseUrl}
        sizes={DEFAULT_GRID_SIZES}
      />
      <DefaultGallery {...props} />
    </>
  )
}
