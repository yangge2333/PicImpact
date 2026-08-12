'use client'

import { useEffect, useRef, useState } from 'react'

const WAKA_ADDRESS = '浙江省杭州市钱塘区4号大街28号国脉科技园1幢'
const FALLBACK_CENTER: [number, number] = [120.36, 30.31]

type AMapLocation = {
  getLng: () => number
  getLat: () => number
}

type AMapMarker = {
  setMap: (map: AMapMap | null) => void
}

type AMapMap = {
  addControl: (control: unknown) => void
  setCenter: (center: [number, number]) => void
  setZoom: (zoom: number) => void
  destroy: () => void
}

type AMapApi = {
  Map: new (container: HTMLElement, options: {
    center: [number, number]
    zoom: number
    viewMode: '2D'
  }) => AMapMap
  Marker: new (options: {
    position: [number, number]
    content: string
    offset: AMapPixel
  }) => AMapMarker
  Pixel: new (x: number, y: number) => AMapPixel
  Scale: new () => unknown
  ToolBar: new () => unknown
  Geocoder: new () => AMapGeocoder
}

type AMapPixel = object

type AMapGeocoder = {
  getLocation: (
    address: string,
    callback: (
      status: string,
      result: { geocodes?: Array<{ location?: AMapLocation }> },
    ) => void,
  ) => void
}

type WindowWithAMapCallback = Window &
  Record<string, (() => void) | undefined>

declare global {
  interface Window {
    AMap?: AMapApi
    _AMapSecurityConfig?: { securityJsCode: string }
  }
}

function loadAMap(apiKey: string, securityJsCode: string) {
  return new Promise<AMapApi>((resolve, reject) => {
    if (window.AMap) {
      resolve(window.AMap)
      return
    }

    const callbackName = `__wakaAMapReady_${Date.now()}`
    const script = document.createElement('script')
    const callbackWindow = window as WindowWithAMapCallback

    window._AMapSecurityConfig = { securityJsCode }
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(apiKey)}&plugin=AMap.Geocoder,AMap.Scale,AMap.ToolBar&callback=${callbackName}`
    script.async = true
    script.onerror = () => {
      delete callbackWindow[callbackName]
      reject(new Error('高德地图加载失败'))
    }
    callbackWindow[callbackName] = () => {
      delete callbackWindow[callbackName]
      if (window.AMap) {
        resolve(window.AMap)
      } else {
        reject(new Error('高德地图初始化失败'))
      }
    }
    document.head.appendChild(script)
  })
}

function markerContent() {
  return '<div style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:9999px;background:#262626;color:#fff;box-shadow:0 0 0 6px rgba(38,38,38,.18),0 8px 18px rgba(0,0,0,.22);font-size:22px;">●</div>'
}

export function WakaLocationMap({
  apiKey,
  securityJsCode,
}: {
  apiKey?: string
  securityJsCode?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AMapMap | null>(null)
  const markerRef = useRef<AMapMarker | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || !apiKey || !securityJsCode) {
      return
    }

    let disposed = false

    loadAMap(apiKey, securityJsCode)
      .then((AMap) => {
        if (disposed || !containerRef.current) return

        const map = new AMap.Map(containerRef.current, {
          center: FALLBACK_CENTER,
          zoom: 16,
          viewMode: '2D',
        })
        mapRef.current = map
        map.addControl(new AMap.Scale())
        map.addControl(new AMap.ToolBar())

        const placeMarker = (center: [number, number]) => {
          markerRef.current?.setMap(null)
          markerRef.current = new AMap.Marker({
            position: center,
            content: markerContent(),
            offset: new AMap.Pixel(-22, -44),
          })
          markerRef.current.setMap(map)
          map.setCenter(center)
          map.setZoom(17)
        }

        const geocoder = new AMap.Geocoder()
        geocoder.getLocation(WAKA_ADDRESS, (status, result) => {
          if (disposed) return

          const location = result.geocodes?.[0]?.location
          if (status === 'complete' && location) {
            placeMarker([location.getLng(), location.getLat()])
          } else {
            placeMarker(FALLBACK_CENTER)
          }
        })
      })
      .catch(() => {
        if (!disposed) setError('高德地图加载失败，请稍后再试')
      })

    return () => {
      disposed = true
      markerRef.current?.setMap(null)
      markerRef.current = null
      mapRef.current?.destroy()
      mapRef.current = null
    }
  }, [apiKey, securityJsCode])

  const displayError = error || (!apiKey || !securityJsCode ? '地图配置暂不可用' : null)

  return (
    <div
      className="relative h-[min(65svh,24rem)] min-h-[18rem] w-full overflow-hidden rounded-2xl border border-border/70 bg-muted shadow-sm"
      aria-label="杭州国脉科技园位置地图"
    >
      <div ref={containerRef} className="size-full" />
      {displayError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/90 p-6 text-center text-sm text-muted-foreground">
          {displayError}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 sm:inset-x-auto sm:right-3">
        <div className="pointer-events-auto max-w-sm rounded-xl border border-border/60 bg-background/90 p-3 shadow-lg backdrop-blur-md">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            WAKA IMPRESSION
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            杭州国脉科技园
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            1幢 2楼 · A-202
          </p>
        </div>
      </div>
    </div>
  )
}
