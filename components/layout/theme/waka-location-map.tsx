'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import Map, {
  Marker,
  NavigationControl,
  ScaleControl,
} from 'react-map-gl/maplibre'
import { MapPin } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useIsHydrated } from '~/hooks/use-is-hydrated'

const WAKA_LOCATION = {
  longitude: 120.353,
  latitude: 30.3082,
  zoom: 16.2,
}

export function WakaLocationMap() {
  const { resolvedTheme } = useTheme()
  const isHydrated = useIsHydrated()

  const mapStyle =
    isHydrated && resolvedTheme === 'dark'
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

  return (
    <div
      className="relative h-[min(65svh,24rem)] min-h-[18rem] w-full overflow-hidden rounded-2xl border border-border/70 bg-muted shadow-sm"
      aria-label="杭州国脉科技园位置地图"
    >
      <Map
        initialViewState={WAKA_LOCATION}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        attributionControl={{}}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" />
        <Marker
          longitude={WAKA_LOCATION.longitude}
          latitude={WAKA_LOCATION.latitude}
          anchor="bottom"
        >
          <div className="relative flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-primary/20">
            <MapPin className="size-5" strokeWidth={2.25} />
          </div>
        </Marker>
      </Map>

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
