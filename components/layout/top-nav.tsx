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
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-2.5 pt-2 sm:px-4">
        <nav className="pointer-events-auto relative mx-auto flex h-11 max-w-[calc(100vw-1.25rem)] items-center justify-between overflow-hidden rounded-[1.35rem] border border-white/42 bg-white/[0.22] px-3 text-foreground shadow-[0_10px_34px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur-[18px] backdrop-saturate-150 dark:border-white/24 dark:bg-black/[0.16] sm:h-12 sm:max-w-[calc(100vw-2rem)] sm:rounded-[1.5rem] sm:px-4 lg:px-5">
          <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0.16)_36%,rgba(255,255,255,0.06)_72%,rgba(255,255,255,0.24)_100%)] opacity-70" />
          <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/70" />
          {/* Left: Site logo/name */}
          <Link
            href="/"
            className="relative shrink-0 font-display text-sm font-semibold tracking-normal text-foreground/88 transition-opacity hover:opacity-70"
          >
            {props.title || 'PicImpact'}
          </Link>

          {/* Center: Album tabs */}
          {showAlbumTabs && (
            <div className="scrollbar-hide relative mx-4 flex items-center gap-1 overflow-x-auto">
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
          <div className="relative flex shrink-0 items-center gap-1">
            <Link
              href="/about"
              className="px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-2"
            >
              关于我
            </Link>
            <button
              type="button"
              onClick={() => router.push('/map')}
              className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('Link.map')}
            >
              <MapPin className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setCommand(true)}
              className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('Command.placeholder')}
            >
              <Search className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isHydrated) {
                  return
                }
                setTheme(resolvedTheme === 'light' ? 'dark' : 'light')
              }}
              className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={themeToggleLabel}
              disabled={!isHydrated}
            >
              {!isHydrated ? <SunMoon className="size-4" /> : resolvedTheme === 'light' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </nav>
      </header>
      <Command />
    </>
  )
}
