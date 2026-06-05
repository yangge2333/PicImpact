'use client'

import type { ImageType } from '~/types'
import { cn } from '~/lib/utils'
import { useRouter } from 'next-nprogress-bar'
import { useBlurImageDataUrl, DEFAULT_HASH } from '~/hooks/use-blurhash.ts'
import { MotionImage } from '~/components/album/motion-image'
import { Skeleton } from '~/components/ui/skeleton'
import { useState } from 'react'
import { Badge } from '~/components/ui/badge.tsx'
import { SIMPLE_GRID_SIZES } from '~/lib/image/grid-image-sizes'

export default function GalleryImage({
  photo,
  priority = false,
}: {
  photo: ImageType
  priority?: boolean
}) {
  const router = useRouter()
  const previewSrc = photo.preview_url || ''
  const [isLoading, setIsLoading] = useState(true)
  const dataURL = useBlurImageDataUrl(photo.blurhash)
  const hasRealBlurhash = !!photo.blurhash && photo.blurhash !== DEFAULT_HASH
  const blurhashOnly = !previewSrc && hasRealBlurhash

  const exifParts: string[] = []
  if (photo?.exif?.make && photo?.exif?.model) exifParts.push(`${photo.exif.make} ${photo.exif.model}`)
  if (photo?.exif?.focal_length) exifParts.push(photo.exif.focal_length)
  if (photo?.exif?.f_number) exifParts.push(photo.exif.f_number)
  if (photo?.exif?.exposure_time) exifParts.push(photo.exif.exposure_time)
  if (photo?.exif?.iso_speed_rating) exifParts.push(`ISO ${photo.exif.iso_speed_rating}`)

  return (
    <div className="w-full">
      <div
        role="link"
        tabIndex={0}
        className="relative cursor-pointer"
        onClick={() => router.push(`/preview/${photo?.id}`)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            router.push(`/preview/${photo?.id}`)
          }
        }}
      >
        {isLoading && previewSrc && (
          <Skeleton
            className={cn(
              'absolute inset-0 z-10 rounded-none',
              hasRealBlurhash ? 'animate-none bg-black/10 backdrop-blur-[2px] dark:bg-white/10' : 'bg-accent'
            )}
          />
        )}
        {previewSrc ? (
          <MotionImage
            src={previewSrc}
            key="preview"
            className={cn('w-full h-auto', isLoading && !hasRealBlurhash && 'animate-pulse')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            alt={photo.title}
            width={photo.width}
            height={photo.height}
            sizes={SIMPLE_GRID_SIZES}
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
            className="w-full bg-cover bg-center"
            style={{
              aspectRatio: photo.width > 0 && photo.height > 0 ? `${photo.width} / ${photo.height}` : '1',
              backgroundImage: `url(${dataURL})`,
            }}
          />
        ) : (
          <Skeleton
            className="w-full rounded-none bg-stone-200/80 dark:bg-white/10"
            style={{ aspectRatio: photo.width > 0 && photo.height > 0 ? `${photo.width} / ${photo.height}` : '1' }}
          />
        )}
      </div>
      <div className="mt-3 px-1">
        <h3 className="font-display text-lg">{photo.title}</h3>
        {exifParts.length > 0 && <p className="text-sm text-muted-foreground mt-1">{exifParts.join(' \u00B7 ')}</p>}
        {photo?.labels && photo.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {photo.labels.map((tag: string) => (
              <Badge
                variant="secondary"
                className="cursor-pointer select-none text-xs"
                key={tag}
                onClick={() => router.push(`/tag/${tag}`)}
              >{tag}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
