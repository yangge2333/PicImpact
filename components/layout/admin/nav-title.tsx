'use client'

import * as React from 'react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar'
import Image from 'next/image'
import fallbackLogo from '~/public/fallback-logo.jpg'
import { useRouter } from 'next-nprogress-bar'

export function NavTitle({
  title,
  logo,
}: {
  title?: string
  logo?: string
}) {
  const router = useRouter()
  const logoSrc = logo || fallbackLogo

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="cursor-pointer select-none" size="lg" onClick={() => router.push('/')}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                <Image src={logoSrc} alt="Logo" width={32} height={32} className="size-8 rounded-md object-cover" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold select-none">
                  {title || 'PicImpact'}
                </span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
