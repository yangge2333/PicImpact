'use client'

import type { ImageHandleProps } from '~/types/props.ts'
import Image from 'next/image'
import useSWRInfinite from 'swr/infinite'
import useSWR from 'swr'
import { useSwrHydrated } from '~/hooks/use-swr-hydrated.ts'
import { useTranslations } from 'next-intl'
import type { GalleryDisplayConfig, ImageType } from '~/types'
import { useState, useCallback, useEffect, useRef, useMemo, useTransition } from 'react'
import MasonryPhotoItem from '~/components/gallery/masonry-photo-item'
import VirtualMasonry from '~/components/gallery/virtual-masonry.tsx'
import InfiniteScroll from '~/components/ui/origin/infinite-scroll.tsx'
import FloatingFilterBall from '~/components/album/floating-filter-ball.tsx'
import { Skeleton } from '~/components/ui/skeleton'

// How many leading items load eagerly (priority) rather than lazily. Sized to
// the widest column count (xl = 5) so the first visible row is always eager,
// which lets the LCP image start downloading immediately. Variants are tiny
// AVIFs (~5KB), so a few eager fetches cost almost nothing.
const LCP_EAGER_COUNT = 5

// Responsive column count matching the previous Tailwind breakpoints
// (columns-2 / sm:columns-3 / lg:columns-4 / xl:columns-5).
function useResponsiveColumnCount(): number {
  const [count, setCount] = useState(2)
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      if (w >= 1280) return 5
      if (w >= 1024) return 4
      if (w >= 640) return 3
      return 2
    }
    const update = () => setCount(compute())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return count
}

const MASONRY_SKELETON_RATIOS = [
  '4 / 5',
  '1 / 1',
  '3 / 4',
  '5 / 4',
  '2 / 3',
  '4 / 3',
  '3 / 5',
  '1 / 1',
  '5 / 6',
  '6 / 5',
  '3 / 4',
  '4 / 5',
]

function MasonrySkeletonGrid() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto columns-1 gap-4 px-5 sm:columns-2 sm:px-8 lg:columns-3 xl:columns-4 2xl:max-w-[1680px]"
    >
      {MASONRY_SKELETON_RATIOS.map((aspectRatio, index) => (
        <div key={`${aspectRatio}-${index}`} className="mb-4 break-inside-avoid">
          <Skeleton
            className="w-full rounded-none bg-stone-200/70 dark:bg-white/10"
            style={{ aspectRatio }}
          />
        </div>
      ))}
    </div>
  )
}

function HeroImage({ photo, priority = false }: { photo?: ImageType, priority?: boolean }) {
  const src = photo?.preview_url || photo?.url || ''
  if (!src) {
    return <div className="absolute inset-0 bg-[linear-gradient(135deg,#191713,#5b5148_45%,#efe9df)]" />
  }
  return (
    <Image
      src={src}
      alt={photo?.detail || photo?.title || ''}
      fill
      priority={priority}
      unoptimized
      sizes="100vw"
      className="object-cover"
    />
  )
}

function EditorialHero({ photos, title }: { photos: ImageType[], title?: string }) {
  const primary = photos[0]
  const secondary = photos[1]
  const tertiary = photos[2]
  return (
    <section className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden bg-stone-950 text-white">
      <HeroImage photo={primary} priority />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,10,8,0.72),rgba(12,10,8,0.28)_46%,rgba(12,10,8,0.08))]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      <div className="relative z-10 flex min-h-[calc(100svh-3.5rem)] items-end px-6 pb-16 pt-20 sm:px-10 lg:px-16 lg:pb-20">
        <div className="max-w-3xl">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.32em] text-white/70">
            Curated Photography
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-normal text-white sm:text-6xl lg:text-7xl">
            {title || primary?.album_name || 'PicImpact'}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/76 sm:text-lg">
            {primary?.detail || primary?.title || 'A quiet collection of light, place, and memory.'}
          </p>
        </div>
      </div>
      {(secondary || tertiary) && (
        <div className="pointer-events-none absolute bottom-12 right-8 z-10 hidden w-[31vw] max-w-[520px] grid-cols-2 gap-3 lg:grid">
          {[secondary, tertiary].filter(Boolean).map((photo, index) => (
            <div
              key={photo!.id}
              className={index === 0 ? 'relative aspect-[4/5] translate-y-10 overflow-hidden shadow-2xl' : 'relative aspect-[4/5] overflow-hidden shadow-2xl'}
            >
              <HeroImage photo={photo} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function DefaultGallery(props : Readonly<ImageHandleProps>) {
  const [selectedCamera, setSelectedCamera] = useState('')
  const [selectedLens, setSelectedLens] = useState('')
  // Debounced filter values for API requests
  const [debouncedCamera, setDebouncedCamera] = useState('')
  const [debouncedLens, setDebouncedLens] = useState('')
  const [, startTransition] = useTransition()
  // Use SWR Infinite for paginated data with filter support - use debounced values
  const { data, isValidating, size, setSize } = useSWRInfinite(
    (index) => {
      return [`client-${props.args}-${index}-${props.album}-${debouncedCamera}-${debouncedLens}`, index]
    },
    ([, index]) => {
      return props.handle(index + 1, props.album, debouncedCamera || undefined, debouncedLens || undefined)
    },
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
    }
  )

  // Use SWR for page total with filter support - use debounced values
  const { data: pageTotal } = useSWR(
    [`pageTotal-${props.args}-${props.album}`, debouncedCamera, debouncedLens],
    () => props.totalHandle(props.album, debouncedCamera || undefined, debouncedLens || undefined),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
      keepPreviousData: true, // Keep previous data while loading new data
    }
  )

  // Public display config (carries the variant CDN base url, when configured).
  const emptyConfig: GalleryDisplayConfig = {
    customIndexDownloadEnable: false,
    customIndexOriginEnable: false,
  }
  const { data: configData } = useSwrHydrated<GalleryDisplayConfig>({
    handle: props.configHandle ?? (async () => emptyConfig),
    args: 'system-config',
  })
  // Prefer the live config, but fall back to the server-passed base on the first
  // render (before the config SWR resolves) so the grid serves AVIF immediately
  // instead of double-loading preview thumbnails.
  const variantBaseUrl = configData?.variantBaseUrl ?? props.variantBaseUrl ?? ''

  // Memoize dataList to avoid unnecessary recalculations
  const dataList = useMemo(() => data?.flat() ?? [], [data])
  const heroPhotos = useMemo(() => dataList.slice(0, 3), [dataList])
  const showInitialSkeleton = dataList.length === 0 && isValidating
  const isPaginating = isValidating && dataList.length > 0
  const columnCount = useResponsiveColumnCount()
  const t = useTranslations()

  // masonic render adapter: receives the column width and item data, renders the
  // shared photo item sized to that column. Memoized on `variantBaseUrl` so
  // masonic keeps a stable render-component identity (avoids remounting items).
  const RenderItem = useMemo(() => {
    return function RenderItem({ index, data, width }: { index: number, data: ImageType, width: number }) {
      // Eager-load the first row(s) so the LCP image is fetched at high priority
      // instead of waiting on the lazy IntersectionObserver. Covers up to the
      // widest column count (5) so the first visible row is always eager.
      return <MasonryPhotoItem photo={data} width={width} variantBaseUrl={variantBaseUrl} priority={index < LCP_EAGER_COUNT} />
    }
  }, [variantBaseUrl])

  // Reset pagination when debounced filters change - SWR key change will auto-refetch
  const prevFiltersRef = useRef({ camera: '', lens: '' })

  // Debounce filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedCamera(selectedCamera)
        setDebouncedLens(selectedLens)
      })
    }, 150)
    return () => clearTimeout(timer)
  }, [selectedCamera, selectedLens])

  useEffect(() => {
    const prev = prevFiltersRef.current
    if (prev.camera !== debouncedCamera || prev.lens !== debouncedLens) {
      prevFiltersRef.current = { camera: debouncedCamera, lens: debouncedLens }
      // Only reset size, SWR will auto-refetch due to key change
      if (size > 1) {
        setSize(1)
      }
    }
  }, [debouncedCamera, debouncedLens, size, setSize])

  const handleCameraChange = useCallback((camera: string) => {
    setSelectedCamera(camera)
  }, [])

  const handleLensChange = useCallback((lens: string) => {
    setSelectedLens(lens)
  }, [])

  const handleReset = useCallback(() => {
    setSelectedCamera('')
    setSelectedLens('')
  }, [])

  return (
    <>
      {heroPhotos.length > 0 && (
        <EditorialHero
          photos={heroPhotos}
          title={configData?.customTitle}
        />
      )}
      <section className="bg-background px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1680px] items-end justify-between gap-6 border-b border-foreground/10 pb-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
              Portfolio
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
              Selected Stories
            </h2>
          </div>
          {dataList.length > 0 && (
            <p className="hidden max-w-xs text-right text-sm leading-6 text-muted-foreground sm:block">
              {dataList.length} photographs
            </p>
          )}
        </div>
      </section>
      <InfiniteScroll
        className="w-full space-y-8 bg-background pb-16"
        hasMore={size < (pageTotal ?? 0)}
        isLoading={isPaginating}
        next={() => setSize(size + 1)}
      >
        {showInitialSkeleton ? (
          <MasonrySkeletonGrid />
        ) : (
          <VirtualMasonry
            className="mx-auto px-5 sm:px-8 lg:px-12 2xl:max-w-[1680px]"
            items={dataList}
            render={RenderItem}
            columnGutter={18}
            columnCount={Math.max(1, columnCount - 1)}
            overscanBy={5}
          />
        )}
        {dataList.length === 0 && !isValidating && (
          <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
            {t('Tips.noImg')}
          </div>
        )}
      </InfiniteScroll>
      {/* Floating Filter Ball */}
      <FloatingFilterBall
        album={props.album}
        selectedCamera={selectedCamera}
        selectedLens={selectedLens}
        onCameraChange={handleCameraChange}
        onLensChange={handleLensChange}
        onReset={handleReset}
      />
    </>
  )
}
