'use client'

import { useRouter } from 'next-nprogress-bar'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { useButtonStore } from '~/app/providers/button-store-providers'
import { useTheme } from 'next-themes'
import type { AlbumDataProps } from '~/types/props'
import type { AlbumType } from '~/types'
import { useIsHydrated } from '~/hooks/use-is-hydrated'
import Link from 'next/link'
import Command from '~/components/layout/command'
import { MapPin, Search, Sun, Moon, SunMoon } from 'lucide-react'

export default function TopNav(props: Readonly<AlbumDataProps>) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const { resolvedTheme, setTheme } = useTheme()
  const isHydrated = useIsHydrated()
  const { setCommand } = useButtonStore(
    (state) => state,
  )

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommand(true)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [setCommand])

  const isActiveTab = (albumValue: string) => {
    if (albumValue === '/') {
      return pathname === '/'
    }
    return pathname === albumValue
  }

  const themeToggleLabel = isHydrated
    ? t(resolvedTheme === 'light' ? 'Button.dark' : 'Button.light')
    : t('Button.theme')
  const showAlbumTabs = pathname !== '/'

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 h-12">
        <div className="absolute inset-0 border-b border-white/10 bg-background/55 backdrop-blur-2xl dark:bg-black/25" />
        <nav className="relative flex h-12 items-center justify-between px-4 lg:px-8">
          {/* Left: Site logo/name */}
          <Link
            href="/"
            className="shrink-0 font-display text-base font-semibold tracking-normal text-foreground transition-opacity hover:opacity-70"
          >
            {props.title || 'PicImpact'}
          </Link>

          {/* Center: Album tabs */}
          {showAlbumTabs && (
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide mx-4">
              <Link
                href="/"
                className={`px-3 py-1 text-xs uppercase tracking-[0.18em] whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  isActiveTab('/')
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('Link.home')}
              </Link>
              {Array.isArray(props.data) && props.data.length > 0 &&
                props.data.map((album: AlbumType) => (
                  <Link
                    key={album.id}
                    href={album.album_value}
                    className={`px-3 py-1 text-xs uppercase tracking-[0.18em] whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      isActiveTab(album.album_value)
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {album.name}
                  </Link>
                ))
              }
            </div>
          )}

          {/* Right: Icon buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => router.push('/map')}
              className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('Link.map')}
            >
              <MapPin size={18} />
            </button>
            <button
              type="button"
              onClick={() => setCommand(true)}
              className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('Command.placeholder')}
            >
              <Search size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isHydrated) {
                  return
                }
                setTheme(resolvedTheme === 'light' ? 'dark' : 'light')
              }}
              className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={themeToggleLabel}
              disabled={!isHydrated}
            >
              {!isHydrated ? <SunMoon size={18} /> : resolvedTheme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </nav>
      </header>
      <Command />
    </>
  )
}
