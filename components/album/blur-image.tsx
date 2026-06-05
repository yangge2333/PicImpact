'use client'

import { useRouter } from 'next-nprogress-bar'
import { useBlurImageDataUrl, DEFAULT_HASH } from '~/hooks/use-blurhash'
import { MotionImage } from '~/components/album/motion-image'
import { Skeleton } from '~/components/ui/skeleton'
import { useState } from 'react'
import { cn } from '~/lib/utils'

export default function BlurImage({ photo }: { photo: any }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const dataURL = useBlurImageDataUrl(photo.blurhash)
  const hasRealBlurhash = !!photo.blurhash && photo.blurhash !== DEFAULT_HASH
  const previewSrc = photo.preview_url || ''
  const blurhashOnly = !previewSrc && hasRealBlurhash

  return (
    <div
      role="link"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(`/preview/${photo?.id}`)
        }
      }}
      className="relative inline-block select-none shadow-sm transition-transform duration-500 ease-out hover:scale-[1.02]">
      {previewSrc && isLoading && <Skeleton className="absolute inset-0 z-10 rounded-none" />}
      {previewSrc ? (
        <MotionImage
          src={previewSrc}
          key="preview"
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={cn('cursor-pointer', isLoading && 'animate-pulse')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          alt={photo.alt || 'Photo'}
          width={photo.width}
          height={photo.height}
          loading="lazy"
          unoptimized
          placeholder={hasRealBlurhash ? 'blur' : 'empty'}
          blurDataURL={dataURL}
          onClick={() => router.push(`/preview/${photo?.id}`)}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />
      ) : blurhashOnly ? (
        <div
          aria-hidden
          className="bg-cover bg-center"
          style={{ backgroundImage: `url(${dataURL})`, width: photo.width, height: photo.height, maxWidth: '100%' }}
          onClick={() => router.push(`/preview/${photo?.id}`)}
        />
      ) : (
        <Skeleton style={{ width: photo.width, height: photo.height, maxWidth: '100%' }} className="rounded-none" />
      )}
    </div>
  )
}
