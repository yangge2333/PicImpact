'use client'

import type { ImageHandleProps } from '~/types/props.ts'
import Image from 'next/image'
import Link from 'next/link'
import useSWRInfinite from 'swr/infinite'
import useSWR from 'swr'
import { useSwrHydrated } from '~/hooks/use-swr-hydrated.ts'
import { useTranslations } from 'next-intl'
import type { GalleryDisplayConfig, ImageType } from '~/types'
import type { CSSProperties } from 'react'
import { useState, useEffect, useRef, useMemo } from 'react'
import MasonryPhotoItem from '~/components/gallery/masonry-photo-item'
import InfiniteScroll from '~/components/ui/origin/infinite-scroll.tsx'
import { Skeleton } from '~/components/ui/skeleton'
import { hasReadyVariants, makeVariantLoader } from '~/lib/image/loader'
import { useAvifSupport } from '~/hooks/use-avif-support'

// How many leading items load eagerly (priority) rather than lazily. Sized to
// the widest column count (xl = 5) so the first visible row is always eager,
// which lets the LCP image start downloading immediately. Variants are tiny
// AVIFs (~5KB), so a few eager fetches cost almost nothing.
const LCP_EAGER_COUNT = 5

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
      className="mx-auto flex w-full flex-col gap-12 px-4 sm:px-8 lg:px-12"
    >
      {MASONRY_SKELETON_RATIOS.map((aspectRatio, index) => (
        <div
          key={`${aspectRatio}-${index}`}
          className="mx-auto w-full max-w-[min(1760px,calc(100vw-2rem))]"
        >
          <Skeleton
            className="w-full rounded-none bg-stone-200/70 dark:bg-white/10"
            style={{ aspectRatio }}
          />
        </div>
      ))}
    </div>
  )
}

function HeroImage({
  photo,
  priority = false,
  variantBaseUrl = '',
}: {
  photo?: ImageType
  priority?: boolean
  variantBaseUrl?: string
}) {
  const avifOk = useAvifSupport()
  if (!photo) {
    return <div className="absolute inset-0 bg-[linear-gradient(135deg,#191713,#5b5148_45%,#efe9df)]" />
  }
  const variantReady = hasReadyVariants(photo.image_key, photo.ready_max_width, variantBaseUrl)
  const imageProps = variantReady
    ? {
        src: photo.image_key,
        loader: makeVariantLoader({
          base: variantBaseUrl,
          imageKey: photo.image_key,
          readyMaxWidth: photo.ready_max_width,
          format: (avifOk ? 'avif' : 'webp') as 'avif' | 'webp',
        }),
      }
    : photo.preview_url
      ? { src: photo.preview_url, unoptimized: true }
      : null

  if (!imageProps) {
    return <div className="absolute inset-0 bg-[linear-gradient(135deg,#191713,#5b5148_45%,#efe9df)]" />
  }

  return (
    <Image
      {...imageProps}
      alt={photo?.detail || photo?.title || ''}
      fill
      priority={priority}
      sizes="100vw"
      className="object-cover"
    />
  )
}

function getPreviewSource(photo?: ImageType) {
  return photo?.preview_url || ''
}

function EditorialHero({
  photos,
  title,
  albums = [],
  variantBaseUrl = '',
}: {
  photos: ImageType[]
  title?: string
  albums?: NonNullable<ImageHandleProps['albums']>
  variantBaseUrl?: string
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [previousPhoto, setPreviousPhoto] = useState<ImageType | undefined>()
  const previousIndexRef = useRef(0)
  const safePhotos = photos.length > 0 ? photos : []
  const primary = safePhotos[activeIndex % safePhotos.length]
  const queuedPhotos = safePhotos.length > 1
    ? Array.from({ length: Math.min(5, safePhotos.length - 1) }, (_, index) => safePhotos[(activeIndex + index + 1) % safePhotos.length])
    : []
  const featuredTitle = primary?.album_name || primary?.title || title || 'PicImpact'
  const channelAlbums = [
    { name: '正片', fallbackDetail: '精选成片作品集' },
    { name: '旅拍', fallbackDetail: '旅途与目的地影像' },
  ].map(({ name, fallbackDetail }) => {
    const album = albums.find((item) => item.name === name || item.album_value.includes(name))
    return {
      name,
      href: album?.album_value || `/${name}`,
      detail: album?.detail || fallbackDetail,
    }
  })
  const fragmentSource = getPreviewSource(previousPhoto)
  const fragmentTiles = useMemo(() => Array.from({ length: 48 }, (_, index) => index), [])

  useEffect(() => {
    if (safePhotos.length <= 1) {
      return
    }
    const timer = window.setInterval(() => {
      setActiveIndex((index) => {
        setPreviousPhoto(safePhotos[index % safePhotos.length])
        previousIndexRef.current = index
        return (index + 1) % safePhotos.length
      })
    }, 5000)
    return () => window.clearInterval(timer)
  }, [safePhotos.length])

  const handleSelectSlide = (index: number) => {
    if (index === activeIndex) {
      return
    }
    setPreviousPhoto(safePhotos[activeIndex])
    previousIndexRef.current = activeIndex
    setActiveIndex(index)
  }

  return (
    <section className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden bg-stone-950 text-white">
      {primary && (
        <div key={primary.id} className="absolute inset-0 hero-image-reveal">
          <HeroImage photo={primary} priority variantBaseUrl={variantBaseUrl} />
        </div>
      )}
      {fragmentSource && previousPhoto && (
        <div
          key={`${previousPhoto.id}-${activeIndex}-${previousIndexRef.current}`}
          className="pointer-events-none absolute inset-0 z-[1] grid grid-cols-8 grid-rows-6"
          aria-hidden="true"
        >
          {fragmentTiles.map((index) => {
            const col = index % 8
            const row = Math.floor(index / 8)
            return (
              <span
                key={index}
                className="hero-fragment-tile"
                style={{
                  backgroundImage: `url(${fragmentSource})`,
                  backgroundPosition: `${(col / 7) * 100}% ${(row / 5) * 100}%`,
                  backgroundSize: '800% 600%',
                  '--fragment-x': `${(col - 3.5) * 18 + 48}px`,
                  '--fragment-y': `${(row - 2.5) * 18 + 62}px`,
                  animationDelay: `${(col + row) * 24}ms`,
                } as CSSProperties}
              />
            )
          })}
        </div>
      )}
      <div className="absolute inset-0 z-[2] bg-[linear-gradient(90deg,rgba(8,8,8,0.78),rgba(8,8,8,0.38)_43%,rgba(8,8,8,0.06)),radial-gradient(circle_at_78%_68%,rgba(255,255,255,0.14),transparent_31%)]" />
      <div className="absolute inset-x-0 bottom-0 z-[3] h-40 bg-gradient-to-t from-background to-transparent" />
      <div className="relative z-10 flex min-h-[calc(100svh-3.5rem)] items-end px-5 pb-14 pt-20 sm:px-10 lg:px-16 lg:pb-20">
        <div className="w-full max-w-[min(58rem,calc(100vw-2.5rem))]">
          <p className="mb-5 text-xs font-medium uppercase text-white/70">
            Featured Gallery
          </p>
          <h1 className="font-display text-[clamp(3.75rem,8vw,8rem)] font-semibold leading-[0.95] tracking-normal text-white">
            {featuredTitle}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/78 sm:text-lg">
            {primary?.detail || 'A cinematic collection of portraits, travel frames, and quiet fragments of light.'}
          </p>
          <div className="mt-10 grid w-full max-w-xl grid-cols-2 gap-px border border-white/28 bg-white/28 sm:max-w-2xl">
            {channelAlbums.map((album) => (
              <Link
                key={album.name}
                href={album.href}
                className="group relative overflow-hidden bg-black/18 px-5 py-5 text-left text-white backdrop-blur-xl transition duration-500 hover:bg-white/16 sm:px-7 sm:py-6"
              >
                <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-white transition-transform duration-500 group-hover:scale-x-100" />
                <span className="block font-display text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-none tracking-normal">
                  {album.name}
                </span>
                <span className="mt-3 block text-xs leading-5 text-white/68 transition-colors group-hover:text-white/86">
                  {album.detail}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      {queuedPhotos.length > 0 && (
        <div className="pointer-events-none absolute bottom-12 right-8 z-10 hidden w-[42vw] max-w-[760px] grid-cols-5 items-end gap-3 lg:grid">
          {queuedPhotos.map((photo, index) => (
            <div
              key={`${photo!.id}-${activeIndex}-${index}`}
              className="relative aspect-[4/5] overflow-hidden shadow-2xl hero-card-in"
              style={{ transform: `translateY(${index % 2 === 0 ? 32 : 0}px)`, animationDelay: `${index * 70}ms` }}
            >
              <HeroImage photo={photo} variantBaseUrl={variantBaseUrl} />
            </div>
          ))}
        </div>
      )}
      <div className="absolute bottom-6 left-6 z-10 flex gap-2 sm:left-auto sm:right-16">
        {safePhotos.slice(0, Math.min(safePhotos.length, 6)).map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            aria-label={`Show featured image ${index + 1}`}
            className={`h-1.5 w-8 bg-white/40 transition-all duration-500 ${index === activeIndex ? 'w-14 bg-white' : 'hover:bg-white/70'}`}
            onClick={() => handleSelectSlide(index)}
          />
        ))}
      </div>
    </section>
  )
}

export default function DefaultGallery(props : Readonly<ImageHandleProps>) {
  // Use SWR Infinite for paginated data with filter support - use debounced values
  const { data, isValidating, size, setSize } = useSWRInfinite(
    (index) => {
      return [`client-${props.args}-${index}-${props.album}`, index]
    },
    ([, index]) => {
      return props.handle(index + 1, props.album)
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
    [`pageTotal-${props.args}-${props.album}`],
    () => props.totalHandle(props.album),
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
  const t = useTranslations()

  return (
    <>
      {heroPhotos.length > 0 && (
        <EditorialHero
          photos={heroPhotos}
          title={configData?.customTitle}
          albums={props.albums}
          variantBaseUrl={variantBaseUrl}
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
          <div className="flex w-full flex-col gap-16 sm:gap-20">
            {dataList.map((photo, index) => {
              const aspectRatio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1
              const isLandscape = aspectRatio >= 1.18
              const isPortrait = aspectRatio < 0.86
              const frameClassName = isLandscape
                ? 'mx-auto w-[calc(100vw-2rem)] max-w-[1880px] sm:w-[calc(100vw-4rem)] lg:w-[calc(100vw-6rem)]'
                : isPortrait
                  ? 'mx-auto w-[min(78vw,760px)] sm:w-[min(58vw,760px)]'
                  : 'mx-auto w-[min(88vw,1040px)]'

              return (
                <MasonryPhotoItem
                  key={photo.id}
                  photo={photo}
                  variantBaseUrl={variantBaseUrl}
                  priority={index < LCP_EAGER_COUNT}
                  className={frameClassName}
                />
              )
            })}
          </div>
        )}
        {dataList.length === 0 && !isValidating && (
          <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
            {t('Tips.noImg')}
          </div>
        )}
      </InfiniteScroll>
    </>
  )
}
