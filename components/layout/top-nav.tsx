'use client'

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
import { Search, Sun, Moon, SunMoon } from 'lucide-react'

export default function TopNav(props: Readonly<AlbumDataProps>) {
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
      <header className="fixed inset-x-0 top-0 z-50 h-10">
        <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/34 via-white/18 to-transparent backdrop-blur-[14px] backdrop-saturate-150 dark:from-black/34 dark:via-black/18" />
        <nav className="relative flex h-10 items-center justify-between px-2.5 sm:px-4 lg:px-6">
          {/* Left: Site logo/name */}
          <Link
            href="/"
            className="shrink-0 font-display text-sm font-semibold tracking-normal text-foreground/88 transition-opacity hover:opacity-70"
          >
            {props.title || 'PicImpact'}
          </Link>

          {/* Center: Album tabs */}
          {showAlbumTabs && (
            <div className="scrollbar-hide mx-4 flex items-center gap-1 overflow-x-auto">
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
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/about"
              className="px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-2"
            >
              关于我
            </Link>
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
