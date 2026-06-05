'use client'

import Image from 'next/image'
import { useRouter } from 'next-nprogress-bar'
import { cn } from '~/lib/utils'
import type { ImageType } from '~/types'
import { Aperture, Timer, Focus, Disc3 } from 'lucide-react'
import { useBlurImageDataUrl, DEFAULT_HASH } from '~/hooks/use-blurhash'
import { Skeleton } from '~/components/ui/skeleton'
import { useState } from 'react'
import { DEFAULT_GRID_SIZES } from '~/lib/image/grid-image-sizes'

export default function MasonryPhotoItem({
  photo,
  width,
  priority = false,
  className,
}: {
  photo: ImageType
  width?: number
  priority?: boolean
  className?: string
}) {
  const router = useRouter()
  const dataURL = useBlurImageDataUrl(photo.blurhash)
  const [isLoading, setIsLoading] = useState(true)

  const exif = photo.exif
  const hasExif = exif && (exif.focal_length || exif.f_number || exif.exposure_time || exif.iso_speed_rating)
  const aspectRatio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1
  const hasRealBlurhash = !!photo.blurhash && photo.blurhash !== DEFAULT_HASH
  const previewSrc = photo.preview_url || ''
  const blurhashOnly = !previewSrc && hasRealBlurhash
  const sizeStyle = typeof width === 'number'
    ? { width, height: Math.round(width / aspectRatio) }
    : { aspectRatio }

  return (
    <div
      role="link"
      tabIndex={0}
      className={cn(
        'group relative cursor-pointer overflow-hidden bg-stone-100 [will-change:auto] hover:[will-change:transform] dark:bg-white/5',
        className
      )}
      style={sizeStyle}
      onClick={() => router.push(`/preview/${photo.id}`)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(`/preview/${photo.id}`)
        }
      }}
    >
      {previewSrc && isLoading && (
        <Skeleton
          className={cn(
            'absolute inset-0 z-10 rounded-none',
            hasRealBlurhash
              ? 'animate-none bg-black/10 backdrop-blur-[2px] dark:bg-white/10'
              : 'bg-stone-200 dark:bg-white/10'
          )}
        />
      )}
      {previewSrc ? (
        <Image
          src={previewSrc}
          key="preview"
          className={cn(
            'object-cover transition duration-700 ease-[var(--ease-out-quart)] group-hover:scale-[1.025] group-hover:brightness-[0.82]',
            isLoading && !hasRealBlurhash && 'animate-pulse'
          )}
          alt={photo.detail || photo.title || ''}
          fill
          sizes={DEFAULT_GRID_SIZES}
          unoptimized
          {...(priority ? { priority: true } : { loading: 'lazy' as const })}
          placeholder={hasRealBlurhash ? 'blur' : 'empty'}
          blurDataURL={dataURL}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />
      ) : blurhashOnly ? (
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${dataURL})` }}
        />
      ) : (
        <Skeleton className="absolute inset-0 rounded-none bg-stone-200/80 dark:bg-white/10" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/58 via-black/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white">
        <h3 className="truncate font-display text-xl font-medium tracking-normal opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 translate-y-2">
          {photo.title}
        </h3>
        {hasExif && (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 translate-y-2">
            {exif.focal_length && (
              <div className="flex items-center gap-1 border border-white/25 bg-white/10 px-2.5 py-1.5 backdrop-blur-md">
                <Focus className="h-3 w-3 text-white/70" />
                <span className="text-white/90">{exif.focal_length}</span>
              </div>
            )}
            {exif.f_number && (
              <div className="flex items-center gap-1 border border-white/25 bg-white/10 px-2.5 py-1.5 backdrop-blur-md">
                <Aperture className="h-3 w-3 text-white/70" />
                <span className="text-white/90">{exif.f_number}</span>
              </div>
            )}
            {exif.exposure_time && (
              <div className="flex items-center gap-1 border border-white/25 bg-white/10 px-2.5 py-1.5 backdrop-blur-md">
                <Timer className="h-3 w-3 text-white/70" />
                <span className="text-white/90">{exif.exposure_time}</span>
              </div>
            )}
            {exif.iso_speed_rating && (
              <div className="flex items-center gap-1 border border-white/25 bg-white/10 px-2.5 py-1.5 backdrop-blur-md">
                <Disc3 className="h-3 w-3 text-white/70" />
                <span className="text-white/90">ISO {exif.iso_speed_rating}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {photo.type === 2 && (
        <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
          <span>Live</span>
        </div>
      )}
    </div>
  )
}
