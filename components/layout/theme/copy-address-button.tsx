'use client'

import { Check, Copy, Navigation } from 'lucide-react'
import { useEffect, useState } from 'react'

export function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      '(max-width: 767px), (pointer: coarse)',
    )
    const updateDeviceType = () => setIsMobile(mediaQuery.matches)

    updateDeviceType()
    mediaQuery.addEventListener('change', updateDeviceType)

    return () => mediaQuery.removeEventListener('change', updateDeviceType)
  }, [])

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  function openNavigation() {
    const params = new URLSearchParams({
      keyword: address,
      city: '杭州市',
      view: 'map',
      src: 'waku',
      callnative: '1',
    })

    window.location.assign(`https://uri.amap.com/search?${params.toString()}`)
  }

  function handleClick() {
    if (isMobile) {
      openNavigation()
      return
    }

    void copyAddress()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
      aria-label={isMobile ? '打开高德地图导航' : '复制完整地址'}
    >
      {copied ? (
        <Check className="size-3.5" />
      ) : isMobile ? (
        <Navigation className="size-3.5" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {copied ? '已复制' : isMobile ? '打开导航' : '复制地址'}
    </button>
  )
}
