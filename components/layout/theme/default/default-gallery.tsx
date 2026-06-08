'use client'

import type { ImageHandleProps } from '~/types/props.ts'
import Image from 'next/image'
import Link from 'next/link'
import useSWRInfinite from 'swr/infinite'
import useSWR from 'swr'
import { useSwrHydrated } from '~/hooks/use-swr-hydrated.ts'
import { useTranslations } from 'next-intl'
import type { GalleryDisplayConfig, ImageType } from '~/types'
import { useState, useEffect, useMemo, useRef } from 'react'
import { FastAverageColor } from 'fast-average-color'
import MasonryPhotoItem from '~/components/gallery/masonry-photo-item'
import InfiniteScroll from '~/components/ui/origin/infinite-scroll.tsx'
import { Skeleton } from '~/components/ui/skeleton'
import { ArrowUp, Camera, ImageIcon, Plane } from 'lucide-react'

// How many leading items load eagerly (priority) rather than lazily. Sized to
// the widest column count (xl = 5) so the first visible row is always eager,
const LCP_EAGER_COUNT = 5
const HERO_ROTATION_INTERVAL_MS = 3500
const HERO_IMAGE_SIZES = '(max-width: 768px) 100vw, 1920px'
const HERO_FALLBACK_COLORS = ['#7c4f3a', '#8aa6a0', '#9e6688', '#b8a044', '#9a6f86']

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

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized.padEnd(6, '0').slice(0, 6)
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

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
  heroPosition = 0,
}: {
  photo?: ImageType
  priority?: boolean
  sizes?: string
  heroPosition?: number
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
      style={{ objectPosition: `${Math.max(0, Math.min(100, 50 + heroPosition / 2))}% center` }}
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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const accordionPhotos = useMemo(
    () => photos,
    [photos]
  )
  const [slideColors, setSlideColors] = useState<string[]>(HERO_FALLBACK_COLORS)
  const featuredTitle = title || '船长的摄影小屋'
  const channelLabels = [
    { name: '正片', detail: '精选成片', href: '/zhengpian', icon: ImageIcon },
    { name: '场照', detail: '现场纪实', href: '/changzhao', icon: Camera },
    { name: '旅拍', detail: '旅途影像', href: '/lvpai', icon: Plane },
  ]
  const handleSelectSlide = (index: number) => {
    if (index === activeIndex) {
      return
    }
    setActiveIndex(index)
  }
  const handleSwipeSlide = (direction: 1 | -1) => {
    if (accordionPhotos.length <= 1) {
      return
    }
    setActiveIndex((index) => (index + direction + accordionPhotos.length) % accordionPhotos.length)
  }

  useEffect(() => {
    if (accordionPhotos.length <= 1) {
      return
    }

    const timer = window.setTimeout(() => {
      setActiveIndex((index) => (index + 1) % accordionPhotos.length)
    }, HERO_ROTATION_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [accordionPhotos.length, activeIndex])

  useEffect(() => {
    let cancelled = false
    const fac = new FastAverageColor()

    Promise.all(
      accordionPhotos.map(async (photo, index) => {
        if (!photo.preview_url) {
          return HERO_FALLBACK_COLORS[index % HERO_FALLBACK_COLORS.length]
        }

        try {
          const color = await fac.getColorAsync(photo.preview_url, {
            algorithm: 'dominant',
            mode: 'speed',
            crossOrigin: 'anonymous',
            ignoredColor: [
              [255, 255, 255, 70, 20],
              [0, 0, 0, 70, 20],
            ],
            silent: true,
          })

          return color.hex || HERO_FALLBACK_COLORS[index % HERO_FALLBACK_COLORS.length]
        } catch {
          return HERO_FALLBACK_COLORS[index % HERO_FALLBACK_COLORS.length]
        }
      })
    ).then((colors) => {
      if (!cancelled) {
        setSlideColors(colors.length > 0 ? colors : HERO_FALLBACK_COLORS)
      }
    })

    return () => {
      cancelled = true
      fac.destroy()
    }
  }, [accordionPhotos])

  return (
    <section className="relative -mt-10 min-h-[100svh] overflow-hidden bg-stone-950 text-white">
      <div
        className="absolute inset-0 flex bg-transparent"
        onClick={(event) => {
          const target = event.target instanceof HTMLElement
            ? event.target.closest<HTMLElement>('[data-hero-slide-index]')
            : null
          const index = Number(target?.dataset.heroSlideIndex)
          if (Number.isInteger(index)) {
            handleSelectSlide(index)
          }
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0]
          if (touch) {
            touchStartRef.current = { x: touch.clientX, y: touch.clientY }
          }
        }}
        onTouchEnd={(event) => {
          const start = touchStartRef.current
          const touch = event.changedTouches[0]
          touchStartRef.current = null
          if (!start || !touch) {
            return
          }
          const deltaX = touch.clientX - start.x
          const deltaY = touch.clientY - start.y
          if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) {
            return
          }
          handleSwipeSlide(deltaX < 0 ? 1 : -1)
        }}
      >
        {accordionPhotos.map((photo, index) => {
          const isActive = index === activeIndex
          return (
            <button
              key={photo.id}
              type="button"
              aria-label={`Show image ${index + 1}`}
              data-active={isActive}
              data-hero-slide-index={index}
              className={`hero-accordion-slide group relative h-full min-w-0 appearance-none overflow-hidden border-0 border-r border-white/10 p-0 text-left transition-[flex,opacity] duration-700 ease-[var(--ease-out-expo)] last:border-r-0 ${
                isActive ? 'flex-[5.8]' : 'flex-[0.72] hover:flex-[1.15]'
              }`}
              onClick={() => handleSelectSlide(index)}
              onFocus={() => handleSelectSlide(index)}
            >
              <HeroImage
                photo={photo}
                priority={index === 0}
                sizes={HERO_IMAGE_SIZES}
                heroPosition={isActive ? 0 : photo.hero_position ?? 0}
              />
              <span className="absolute inset-0 bg-black/0 transition-colors duration-700" />
              <span className={`absolute bottom-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase text-white/72 transition-opacity duration-500 xl:block ${
                isActive ? 'opacity-0' : 'opacity-80'
              }`}>
                {photo.album_name || photo.title || `0${index + 1}`}
              </span>
            </button>
          )
        })}
      </div>
      <div className="scrollbar-hide absolute left-1/2 top-0 z-20 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto px-3 py-2 sm:gap-2.5">
        {accordionPhotos.map((photo, index) => {
          const color = slideColors[index] || HERO_FALLBACK_COLORS[index % HERO_FALLBACK_COLORS.length]
          const isActive = index === activeIndex

          return (
            <button
              key={`hero-indicator-${photo.id}`}
              type="button"
              aria-label={`Show featured image ${index + 1}`}
              className={`block border border-white/65 transition-all duration-500 ease-[var(--ease-out-expo)] ${
                isActive ? 'h-5 w-4 shadow-[0_0_22px_rgba(255,255,255,0.26)]' : 'h-2.5 w-2.5 opacity-80 hover:opacity-100'
              }`}
              style={{
                backgroundColor: color,
                boxShadow: isActive ? `0 0 24px ${hexToRgba(color, 0.5)}` : undefined,
              }}
              onClick={() => handleSelectSlide(index)}
            />
          )
        })}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[3] h-[42svh] bg-transparent sm:h-[38svh]" />
      <div className="pointer-events-none relative z-10 flex min-h-[100svh] items-end px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-14 sm:px-8 sm:pb-8 sm:pt-20 md:pb-8 lg:px-14 lg:pb-7">
        <div
          className="pointer-events-auto relative w-full max-w-[min(48rem,calc(100vw-2rem))] overflow-visible"
        >
          <div className="w-fit max-w-full pb-5 pr-10 pt-2 sm:pb-6 sm:pr-16">
            <p className="font-hero-cinzel mb-2 text-[8px] font-medium uppercase tracking-[0.14em] text-white/52 sm:mb-3 sm:text-[9px]">
              Featured Gallery
            </p>
            <h1 className="font-hero-title text-[clamp(2rem,9vw,2.85rem)] font-medium leading-[1.05] tracking-[0.08em] text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.28)] sm:text-[clamp(2.45rem,3.6vw,4.05rem)]">
              {featuredTitle}
            </h1>
            <p className="mt-3 max-w-[34rem] text-[11px] leading-relaxed tracking-[0.08em] text-white/58 sm:mt-4 sm:text-[13px] sm:leading-6">
              光影的诗意栖居，定格每一刻心动与宁静。
            </p>
          </div>
          <div className="mt-1 grid w-full max-w-[22.5rem] grid-cols-3 gap-2.5 sm:mt-3 sm:max-w-[31rem] sm:gap-3 md:max-w-[34rem]">
            {channelLabels.map((item) => {
              const Icon = item.icon
              const isActive = item.name === '正片'

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group relative min-h-[3.35rem] overflow-hidden rounded-xl border px-2.5 py-2.5 text-left text-white shadow-[0_8px_20px_rgba(255,255,255,0.035)] backdrop-blur-[12px] transition-[background-color,border-color,transform] duration-300 hover:-translate-y-0.5 hover:bg-white/[0.18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:min-h-[4rem] sm:rounded-[0.9rem] sm:px-3.5 sm:py-3 ${
                    isActive ? 'border-white/42 bg-white/[0.15]' : 'border-white/28 bg-white/[0.11]'
                  }`}
                >
                  <span className="flex items-start gap-2 sm:gap-3">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-white/58 transition-colors group-hover:text-white/72 sm:size-4" strokeWidth={1.55} />
                    <span className="min-w-0">
                      <span className="font-hero-title block text-[0.98rem] font-medium leading-none tracking-[0.06em] sm:text-[1.28rem]">
                        {item.name}
                      </span>
                      <span className="mt-1 block text-[8px] leading-3 text-white/62 sm:mt-1.5 sm:text-[10px] sm:leading-4">
                        {item.detail}
                      </span>
                    </span>
                  </span>
                </Link>
              )
            })}
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
  const showHero = props.showHero ?? false
  const showInitialSkeleton = dataList.length === 0 && isValidating
  const isPaginating = isValidating && dataList.length > 0
  const t = useTranslations()

  useEffect(() => {
    if (showHero && pageTotal && size < pageTotal) {
      setSize(pageTotal)
    }
  }, [pageTotal, setSize, showHero, size])

  if (showHero && dataList.length > 0) {
    return (
      <EditorialHero
        photos={dataList}
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
