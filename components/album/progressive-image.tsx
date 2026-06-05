'use client'

import type { ProgressiveImageProps } from '~/types/props.ts'
import { Activity } from 'react'
import { useTranslations } from 'next-intl'
import { MotionImage } from '~/components/album/motion-image'
import { useBlurImageDataUrl } from '~/hooks/use-blurhash'

export default function ProgressiveImage(
  props: Readonly<ProgressiveImageProps>,
) {
  const t = useTranslations()
  const dataURL = useBlurImageDataUrl(props.blurhash)
  const previewSrc = props.previewUrl || props.imageUrl

  const closeLightbox = () => {
    props.onShowLightboxChange?.(false)
  }

  return (
    <div className="relative">
      <MotionImage
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="object-contain md:max-h-[90vh] cursor-pointer"
        src={previewSrc}
        overrideSrc={previewSrc}
        placeholder="blur"
        unoptimized
        blurDataURL={dataURL}
        width={props.width}
        height={props.height}
        alt={props.alt || 'image'}
        onClick={() => props.onShowLightboxChange?.(true)}
      />
      <Activity mode={props.showLightbox ? 'visible' : 'hidden'}>
        <div
          className="fixed inset-0 z-[100] bg-background/95 flex items-center justify-center overflow-auto"
          style={{ pointerEvents: props.showLightbox ? 'auto' : 'none' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeLightbox()
            }
          }}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-[110] p-2 rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
            aria-label={t('Button.close')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-foreground"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <img
            className="max-w-full max-h-full object-contain"
            src={previewSrc}
            width={props.width}
            height={props.height}
            alt={props.alt || 'image'}
          />
        </div>
      </Activity>
    </div>
  )
}
