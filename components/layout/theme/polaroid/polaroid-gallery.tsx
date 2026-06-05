'use client'

import { useMemo, useState, useRef, useCallback, memo } from 'react'
import type { ImageHandleProps } from '~/types/props.ts'
import useSWRInfinite from 'swr/infinite'
import { useSwrHydrated } from '~/hooks/use-swr-hydrated.ts'
import { DraggableCardBody, DraggableCardContainer } from '~/components/ui/origin/draggable-card.tsx'
import type { GalleryDisplayConfig, ImageType } from '~/types'
import Image from 'next/image'
import { Skeleton } from '~/components/ui/skeleton'
import { useBlurImageDataUrl } from '~/hooks/use-blurhash'
import { cn } from '~/lib/utils'
import { POLAROID_GRID_SIZES } from '~/lib/image/grid-image-sizes'

const POLAROID_STYLES = [
  { cardW: 54, cardH: 86, imgW: 46, imgH: 62 },
  { cardW: 108, cardH: 86, imgW: 99, imgH: 62 },
  { cardW: 72, cardH: 86, imgW: 62, imgH: 62 },
  { cardW: 53.9, cardH: 66.6, imgW: 47, imgH: 46 },
  { cardW: 103, cardH: 102, imgW: 92, imgH: 73 },
  { cardW: 88.5, cardH: 107.5, imgW: 78.9, imgH: 76.8 },
]

const PolaroidCard = memo(function PolaroidCard({
  item,
  style,
  onMouseDown,
  zIndex,
  priority = false,
}: {
  item: ImageType
  style: React.CSSProperties
  onMouseDown: (id: string) => void
  zIndex: number
  priority?: boolean
}) {
  const [isLoading, setIsLoading] = useState(true)
  const blurDataUrl = useBlurImageDataUrl(item.blurhash)
  const previewSrc = item.preview_url || ''

  if (!item.width || !item.height || item.width <= 0 || item.height <= 0) {
    return null
  }

  const selectedStyle = useMemo(() => {
    const imgRatio = item.width / item.height
    return POLAROID_STYLES.reduce((prev, curr) => {
      const currRatio = curr.imgW / curr.imgH
      const prevRatio = prev.imgW / prev.imgH
      return Math.abs(imgRatio - currRatio) < Math.abs(imgRatio - prevRatio) ? curr : prev
    })
  }, [item.width, item.height])

  const scale = 3.8
  const cardWidth = selectedStyle.cardW * scale
  const cardHeight = selectedStyle.cardH * scale
  const imgWidth = selectedStyle.imgW * scale
  const imgHeight = selectedStyle.imgH * scale
  const paddingSide = (cardWidth - imgWidth) / 2
  const paddingTop = paddingSide
  const paddingBottom = cardHeight - imgHeight - paddingTop

  return (
    <DraggableCardBody
      className="absolute flex flex-col p-0 shadow-xl min-h-0 h-auto bg-white dark:bg-neutral-50 rounded-sm"
      style={{
        ...style,
        zIndex,
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        padding: `${paddingTop}px ${paddingSide}px ${paddingBottom}px ${paddingSide}px`,
      }}
      onMouseDown={() => onMouseDown(item.id)}
    >
      <div className="relative overflow-hidden bg-muted shrink-0 w-full h-full shadow-inner">
        {previewSrc && isLoading && <Skeleton className="absolute inset-0 z-20 rounded-none" />}
        {previewSrc ? (
          <Image
            src={previewSrc}
            key="preview"
            alt={item.title}
            width={Math.round(imgWidth)}
            height={Math.round(imgHeight)}
            className={cn(
              'pointer-events-none relative z-10 h-full w-full object-cover transition-opacity duration-500',
              isLoading ? 'opacity-0' : 'opacity-100'
            )}
            placeholder="blur"
            blurDataURL={blurDataUrl}
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            sizes={POLAROID_GRID_SIZES}
            priority={priority}
            unoptimized
          />
        ) : (
          <div
            aria-hidden
            className="pointer-events-none relative z-10 h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${blurDataUrl})` }}
          />
        )}
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center px-2 overflow-hidden"
        style={{ height: `${paddingBottom}px` }}
      >
        <h3 className="w-full text-center text-sm font-medium text-muted-foreground truncate opacity-80">
          {item.title}
        </h3>
      </div>
    </DraggableCardBody>
  )
})

export default function PolaroidGallery(props: Readonly<ImageHandleProps>) {
  const emptyConfig: GalleryDisplayConfig = {
    customIndexDownloadEnable: false,
    customIndexOriginEnable: false,
  }
  const { data: configData } = useSwrHydrated<GalleryDisplayConfig>({
    handle: props.configHandle ?? (async () => emptyConfig),
    args: 'system-config',
  })

  const customTitle = configData?.customTitle

  const { data } = useSWRInfinite((index) => {
    return [`client-${props.args}-${index}-${props.album}`, index]
  },
    ([_, index]) => {
      return props.handle(index + 1, props.album)
    }, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
  })

  const dataList = useMemo(() => data?.flat() ?? [], [data])
  const positionsRef = useRef<Record<string, { top: string, left: string, rotate: string }>>({})

  const currentPositions = useMemo(() => {
    dataList.forEach((item: ImageType) => {
      if (!positionsRef.current[item.id]) {
        positionsRef.current[item.id] = {
          top: `${Math.floor(Math.random() * 40) + 10}%`,
          left: `${Math.floor(Math.random() * 50) + 10}%`,
          rotate: `${Math.floor(Math.random() * 20) - 10}deg`,
        }
      }
    })
    return positionsRef.current
  }, [dataList])

  const maxZIndexRef = useRef(10)
  const [cardZIndices, setCardZIndices] = useState<Record<string, number>>({})

  const handleCardClick = useCallback((id: string) => {
    maxZIndexRef.current += 1
    const newZIndex = maxZIndexRef.current
    setCardZIndices((prev) => ({
      ...prev,
      [id]: newZIndex,
    }))
  }, [])

  return (
    <DraggableCardContainer className="relative flex min-h-screen w-full items-center justify-center overflow-clip">
      <p className="absolute top-1/2 mx-auto max-w-sm -translate-y-3/4 text-center text-2xl font-black text-muted-foreground md:text-4xl">
        {customTitle || 'PicImpact'}
      </p>
      {dataList?.map((item: ImageType, index: number) => (
        <PolaroidCard
          key={item.id}
          item={item}
          style={currentPositions[item.id]}
          zIndex={cardZIndices[item.id] || 1}
          onMouseDown={handleCardClick}
          priority={index < 3}
        />
      ))}
    </DraggableCardContainer>
  )
}
