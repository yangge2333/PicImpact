'use client'

import type { ImageHandleProps } from '~/types/props.ts'
import Image from 'next/image'
import Link from 'next/link'
import useSWRInfinite from 'swr/infinite'
import useSWR from 'swr'
import { useSwrHydrated } from '~/hooks/use-swr-hydrated.ts'
import { useTranslations } from 'next-intl'
import type { GalleryDisplayConfig, ImageType } from '~/types'
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

function getHeroTextureSource(photo?: ImageType, variantBaseUrl = '', useAvif = false) {
  if (!photo) {
    return ''
  }
  if (hasReadyVariants(photo.image_key, photo.ready_max_width, variantBaseUrl)) {
    return makeVariantLoader({
      base: variantBaseUrl,
      imageKey: photo.image_key,
      readyMaxWidth: photo.ready_max_width,
      format: useAvif ? 'avif' : 'webp',
    })({ src: photo.image_key, width: Math.min(photo.ready_max_width || 1920, 1920), quality: 80 })
  }
  return photo.preview_url || ''
}

function LiquidDisplacementLayer({
  from,
  to,
  trigger,
}: {
  from: string
  to: string
  trigger: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !from || !to) {
      return
    }
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false })
    if (!gl) {
      return
    }

    let frame = 0
    let cancelled = false
    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `
    const fragmentSource = `
      precision mediump float;
      varying vec2 v_uv;
      uniform sampler2D u_from;
      uniform sampler2D u_to;
      uniform float u_progress;
      uniform float u_time;
      uniform float u_canvas_ratio;
      uniform float u_from_ratio;
      uniform float u_to_ratio;

      float wave(vec2 uv, float scale, float speed) {
        return sin((uv.y * scale + u_time * speed)) * 0.5 + sin((uv.x * scale * 0.72 - u_time * speed * 0.8)) * 0.5;
      }

      vec2 coverUv(vec2 uv, float imageRatio) {
        vec2 scale = imageRatio > u_canvas_ratio
          ? vec2(u_canvas_ratio / imageRatio, 1.0)
          : vec2(1.0, imageRatio / u_canvas_ratio);
        return (uv - 0.5) * scale + 0.5;
      }

      void main() {
        float p = smoothstep(0.0, 1.0, u_progress);
        float force = sin(p * 3.14159265);
        vec2 direction = vec2(0.045, -0.028) * force;
        float w = wave(v_uv, 18.0, 0.004) + wave(v_uv + 0.21, 31.0, 0.006);
        vec2 pull = direction * w;
        vec2 uvFrom = coverUv(v_uv + pull + vec2((1.0 - p) * force * 0.026, 0.0), u_from_ratio);
        vec2 uvTo = coverUv(v_uv - pull + vec2(-p * force * 0.026, 0.0), u_to_ratio);
        vec4 a = texture2D(u_from, uvFrom);
        vec4 b = texture2D(u_to, uvTo);
        vec4 color = mix(a, b, p);
        color.rgb += force * 0.035;
        color.a = 1.0 - smoothstep(0.92, 1.0, p);
        gl_FragColor = color;
      }
    `

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vertexShader = compile(gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource)
    if (!vertexShader || !fragmentShader) {
      return
    }
    const program = gl.createProgram()
    if (!program) {
      return
    }
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return
    }

    const loadTexture = (src: string, unit: number) => new Promise<{ texture: WebGLTexture, ratio: number } | null>((resolve) => {
      const image = new window.Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => {
        const texture = gl.createTexture()
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
          if (texture) {
            resolve({ texture, ratio: image.naturalWidth / image.naturalHeight })
          } else {
            resolve(null)
          }
        } catch {
          resolve(null)
        }
      }
      image.onerror = () => resolve(null)
      image.src = src
    })

    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio))
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    Promise.all([loadTexture(from, 0), loadTexture(to, 1)]).then(([fromImage, toImage]) => {
      if (cancelled || !fromImage || !toImage) {
        return
      }
      resize()
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
      const position = gl.getAttribLocation(program, 'a_position')
      const progress = gl.getUniformLocation(program, 'u_progress')
      const time = gl.getUniformLocation(program, 'u_time')
      const canvasRatio = gl.getUniformLocation(program, 'u_canvas_ratio')
      const fromRatio = gl.getUniformLocation(program, 'u_from_ratio')
      const toRatio = gl.getUniformLocation(program, 'u_to_ratio')
      gl.useProgram(program)
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
      gl.uniform1i(gl.getUniformLocation(program, 'u_from'), 0)
      gl.uniform1i(gl.getUniformLocation(program, 'u_to'), 1)
      const started = performance.now()
      const render = (now: number) => {
        if (cancelled) return
        resize()
        const elapsed = now - started
        const p = Math.min(1, elapsed / 1450)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.uniform1f(progress, p)
        gl.uniform1f(time, elapsed)
        gl.uniform1f(canvasRatio, canvas.width / canvas.height)
        gl.uniform1f(fromRatio, fromImage.ratio)
        gl.uniform1f(toRatio, toImage.ratio)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        if (p < 1) {
          frame = requestAnimationFrame(render)
        }
      }
      frame = requestAnimationFrame(render)
    })

    return () => {
      cancelled = true
      if (frame) cancelAnimationFrame(frame)
    }
  }, [from, to, trigger])

  if (!from || !to) {
    return null
  }

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[1] h-full w-full" aria-hidden="true" />
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
  const avifOk = useAvifSupport()
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
  const previousTexture = getHeroTextureSource(previousPhoto, variantBaseUrl, avifOk)
  const currentTexture = getHeroTextureSource(primary, variantBaseUrl, avifOk)

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
      <LiquidDisplacementLayer
        from={previousTexture}
        to={currentTexture}
        trigger={activeIndex}
      />
      <div className="absolute inset-x-0 bottom-0 z-[3] h-36 bg-gradient-to-t from-background/88 via-background/48 to-transparent" />
      <div className="relative z-10 flex min-h-[calc(100svh-3.5rem)] items-end px-5 pb-12 pt-20 sm:px-10 md:pb-14 lg:px-16 lg:pb-16">
        <div className="relative w-full max-w-[min(46rem,calc(100vw-2.5rem))] overflow-hidden border border-white/10 bg-black/22 px-4 py-4 shadow-[0_20px_76px_rgba(0,0,0,0.2)] backdrop-blur-[2px] sm:px-5 sm:py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase text-white/62">
            Featured Gallery
          </p>
          <h1 className="whitespace-nowrap font-display text-[clamp(2.35rem,3.85vw,3.95rem)] font-semibold leading-none tracking-normal text-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.32)]">
            {featuredTitle}
          </h1>
          <p className="mt-4 max-w-md text-xs leading-6 text-white/72 sm:text-sm">
            {primary?.detail || 'A cinematic collection of portraits, travel frames, and quiet fragments of light.'}
          </p>
          <div className="mt-5 grid w-full max-w-[23rem] grid-cols-2 gap-2">
            {channelAlbums.map((album) => (
              <Link
                key={album.name}
                href={album.href}
                className="group relative overflow-hidden border border-white/22 bg-black/18 px-4 py-3 text-left text-white shadow-[0_14px_44px_rgba(0,0,0,0.16)] backdrop-blur-xl transition duration-500 hover:border-white/58 hover:bg-white/12 sm:px-4 sm:py-3.5"
              >
                <span className="absolute inset-x-3 bottom-0 h-px origin-left scale-x-0 bg-white transition-transform duration-500 group-hover:scale-x-100" />
                <span className="block font-display text-[clamp(1.35rem,2.2vw,1.9rem)] font-semibold leading-none tracking-normal">
                  {album.name}
                </span>
                <span className="mt-2 block text-[10px] leading-4 text-white/58 transition-colors group-hover:text-white/84">
                  {album.detail}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      {queuedPhotos.length > 0 && (
        <div className="pointer-events-none absolute bottom-12 right-8 z-10 hidden w-[38vw] max-w-[620px] grid-cols-5 items-end gap-2 xl:grid">
          {queuedPhotos.map((photo, index) => (
            <div
              key={`${photo!.id}-${activeIndex}-${index}`}
              className="relative aspect-[4/5] overflow-hidden border border-white/14 shadow-2xl hero-card-in"
              style={{ transform: `translateY(${index % 2 === 0 ? 24 : 0}px)`, animationDelay: `${index * 70}ms` }}
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
  const heroPhotos = useMemo(() => dataList.slice(0, 6), [dataList])
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
