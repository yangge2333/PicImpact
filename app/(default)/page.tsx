import type { ImageHandleProps } from '~/types/props'
import { getImagesData, getImagesPageTotal, getDisplayConfig, initDailyIfNeeded } from '~/server/actions/images'
import { cachedAlbumsShow } from '~/server/lib/cache'
import DefaultGallery from '~/components/layout/theme/default/default-gallery.tsx'

export default async function Home() {
  await initDailyIfNeeded()

  // Server-side data for the LCP preload hint: the first gallery image and the
  // variant CDN base. Best-effort — a failure here must never break the page.
  const [albums] = await Promise.all([
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
  }

  return (
    <DefaultGallery {...props} />
  )
}
