'use client'

import type { ImageHandleProps } from '~/types/props.ts'
import Image from 'next/image'
import Link from 'next/link'
import useSWRInfinite from 'swr/infinite'
import useSWR from 'swr'
import { useSwrHydrated } from '~/hooks/use-swr-hydrated.ts'
import { useTranslations } from 'next-intl'
import type { GalleryDisplayConfig, ImageType } from '~/types'
import { useState, useEffect, useMemo } from 'react'
import MasonryPhotoItem from '~/components/gallery/masonry-photo-item'
import InfiniteScroll from '~/components/ui/origin/infinite-scroll.tsx'
import { Skeleton } from '~/components/ui/skeleton'
import { ArrowUp } from 'lucide-react'

// How many leading items load eagerly (priority) rather than lazily. Sized to
// the widest column count (xl = 5) so the first visible row is always eager,
const LCP_EAGER_COUNT = 5
const HERO_PHOTO_COUNT = 5
const HERO_ROTATION_INTERVAL_MS = 3500
const HERO_IMAGE_SIZES = '(max-width: 768px) 100vw, 1920px'

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
  sizes = HERO_IMAGE_SIZES,
}: {
  photo?: ImageType
  priority?: boolean
  sizes?: string
}) {
  if (!photo) {
    return <div className="absolute inset-0 bg-[linear-gradient(135deg,#191713,#5b5148_45%,#efe9df)]" />
  }
  const imageProps = photo.preview_url ? { src: photo.preview_url } : null

  if (!imageProps) {
    return <div className="absolute inset-0 bg-[linear-gradient(135deg,#191713,#5b5148_45%,#efe9df)]" />
  }

  return (
    <Image
      {...imageProps}
      alt={photo?.detail || photo?.title || ''}
      fill
      priority={priority}
      sizes={sizes}
      unoptimized
      className="object-cover"
    />
  )
}

function EditorialHero({
  photos,
  title,
}: {
  photos: ImageType[]
  title?: string
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const safePhotos = photos.length > 0 ? photos : []
  const primary = safePhotos[activeIndex % safePhotos.length]
  const accordionPhotos = safePhotos.slice(0, Math.min(safePhotos.length, HERO_PHOTO_COUNT))
  const featuredTitle = title || '船长的摄影小屋'
  const channelLabels = [
    { name: '正片', detail: '精选成片作品集', href: '/zhengpian' },
    { name: '场照', detail: '活动现场纪实', href: '/changzhao' },
    { name: '旅拍', detail: '旅途与目的地影像', href: '/lvpai' },
  ]
  const handleSelectSlide = (index: number) => {
    if (index === activeIndex) {
      return
    }
    setActiveIndex(index)
  }

  useEffect(() => {
    if (accordionPhotos.length <= 1) {
      setProgress(100)
      return
    }

    let animationFrame = 0
    let startedAt = window.performance.now()

    const updateProgress = (timestamp: number) => {
      const nextProgress = ((timestamp - startedAt) / HERO_ROTATION_INTERVAL_MS) * 100

      if (nextProgress >= 100) {
        setProgress(0)
        setActiveIndex((index) => (index + 1) % accordionPhotos.length)
        startedAt = timestamp
      } else {
        setProgress(nextProgress)
      }

      animationFrame = window.requestAnimationFrame(updateProgress)
    }

    setProgress(0)
    animationFrame = window.requestAnimationFrame(updateProgress)

    return () => window.cancelAnimationFrame(animationFrame)
  }, [accordionPhotos.length, activeIndex])

  return (
    <section className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden bg-stone-950 text-white">
      <div className="absolute inset-0 flex bg-black">
        {accordionPhotos.map((photo, index) => {
          const isActive = index === activeIndex
          return (
            <button
              key={photo.id}
              type="button"
              aria-label={`Show image ${index + 1}`}
              data-active={isActive}
              className={`hero-accordion-slide group relative h-full min-w-0 appearance-none overflow-hidden border-0 border-r border-white/10 p-0 text-left transition-[flex,opacity] duration-700 ease-[var(--ease-out-expo)] last:border-r-0 ${
                isActive ? 'flex-[5.8]' : 'flex-[0.72] hover:flex-[1.15]'
              }`}
              onClick={() => handleSelectSlide(index)}
              onFocus={() => handleSelectSlide(index)}
            >
              <HeroImage
                photo={photo}
                priority
                sizes={HERO_IMAGE_SIZES}
              />
              <span className={`absolute inset-0 transition-colors duration-700 ${
                isActive ? 'bg-black/0' : 'bg-black/34 group-hover:bg-black/14'
              }`} />
              <span className={`absolute bottom-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase text-white/72 transition-opacity duration-500 xl:block ${
                isActive ? 'opacity-0' : 'opacity-80'
              }`}>
                {photo.album_name || photo.title || `0${index + 1}`}
              </span>
            </button>
          )
        })}
      </div>
      <div className="absolute left-1/2 top-16 z-20 h-[5px] w-36 -translate-x-1/2 overflow-hidden rounded-full border border-white/55 bg-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.22)] backdrop-blur-sm sm:top-20 sm:w-44">
        <span
          className="block h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[3] h-36 bg-gradient-to-t from-background/88 via-background/48 to-transparent" />
      <div className="relative z-10 flex min-h-[calc(100svh-3.5rem)] items-end px-5 pb-12 pt-20 sm:px-10 md:pb-14 lg:px-16 lg:pb-16">
        <div className="relative w-full max-w-[min(40rem,calc(100vw-2.5rem))] overflow-hidden border border-white/12 bg-black/30 px-5 py-5 shadow-[0_20px_76px_rgba(0,0,0,0.24)] backdrop-blur-md sm:px-6 sm:py-5">
          <p className="mb-4 text-[10px] font-semibold uppercase text-white/64">
            Featured Gallery
          </p>
          <h1 className="font-display text-[clamp(2.1rem,3.35vw,3.65rem)] font-semibold leading-[1.05] tracking-normal text-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.32)]">
            {featuredTitle}
          </h1>
          <p className="mt-4 max-w-[34rem] text-xs leading-6 text-white/76 sm:text-sm">
            {primary?.detail || 'A cinematic collection of portraits, travel frames, and quiet fragments of light.'}
          </p>
          <p className="mt-2 text-xs leading-5 text-white/68 sm:text-sm">
            联系方式 QQ: 774202796 WX: 13634085297
          </p>
          <div className="mt-6 grid w-full max-w-[26rem] grid-cols-3 gap-2.5">
            {channelLabels.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="relative min-h-[4.75rem] overflow-hidden border border-white/20 bg-white/8 px-4 py-3 text-left text-white shadow-[0_14px_44px_rgba(0,0,0,0.14)] backdrop-blur-xl transition-colors hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:px-4 sm:py-3.5"
              >
                <span className="block font-display text-[clamp(1.18rem,1.7vw,1.55rem)] font-semibold leading-none tracking-normal">
                  {item.name}
                </span>
                <span className="mt-2 block text-[10px] leading-4 text-white/58">
                  {item.detail}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute bottom-6 right-6 z-10 hidden gap-2 md:flex">
        {accordionPhotos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            aria-label={`Show featured image ${index + 1}`}
            className={`h-1.5 w-7 bg-white/38 transition-all duration-500 ${index === activeIndex ? 'w-12 bg-white' : 'hover:bg-white/70'}`}
            onClick={() => handleSelectSlide(index)}
          />
        ))}
      </div>
    </section>
  )
}

function ScrollTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => {
      setVisible(window.scrollY > 420)
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  return (
    <button
      type="button"
      aria-label="Back to top"
      className={`fixed bottom-5 right-5 z-40 grid h-12 w-12 place-items-center rounded-full border border-foreground/15 bg-background/72 text-foreground shadow-[0_14px_42px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-background/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:bottom-7 sm:right-7 ${
        visible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ArrowUp size={22} strokeWidth={1.8} />
    </button>
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

  const emptyConfig: GalleryDisplayConfig = {
    customIndexDownloadEnable: false,
    customIndexOriginEnable: false,
  }
  const { data: configData } = useSwrHydrated<GalleryDisplayConfig>({
    handle: props.configHandle ?? (async () => emptyConfig),
    args: 'system-config',
  })
  // Memoize dataList to avoid unnecessary recalculations
  const dataList = useMemo(() => data?.flat() ?? [], [data])
  const heroPhotos = useMemo(() => dataList.slice(0, HERO_PHOTO_COUNT), [dataList])
  const showHero = props.showHero ?? false
  const showInitialSkeleton = dataList.length === 0 && isValidating
  const isPaginating = isValidating && dataList.length > 0
  const t = useTranslations()

  if (showHero && heroPhotos.length > 0) {
    return (
      <EditorialHero
        photos={heroPhotos}
        title={configData?.customTitle}
      />
    )
  }

  return (
    <>
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
      {!showHero && <ScrollTopButton />}
    </>
  )
}
