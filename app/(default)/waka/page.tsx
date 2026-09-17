import Image from 'next/image'
import { CopyAddressButton } from '~/components/layout/theme/copy-address-button'
import { WakaLocationMap } from '~/components/layout/theme/waka-location-map'
import { cachedConfigsByKeys } from '~/server/lib/cache'
import { toCustomInfo } from '~/server/lib/config-transform'
import { fetchEquipmentAssets } from '~/server/db/query/equipment-assets'

export async function generateMetadata() {
  const rows = await cachedConfigsByKeys(['custom_title'])
  const siteTitle = toCustomInfo(rows).customTitle || 'PicImpact'

  return {
    title: `哇咔 | ${siteTitle}`,
  }
}

export default async function WakaImpressionPage() {
  const rows = await cachedConfigsByKeys(['custom_title'])
  const title = toCustomInfo(rows).customTitle || '船长的摄影小屋'
  const amapKey = process.env.AMAP_JS_API_KEY
  const amapSecurityCode = process.env.AMAP_SECURITY_JSCODE
  const equipment = await fetchEquipmentAssets({ page: 1, pageSize: 100 })
  const equipmentGroups = Array.from(
    equipment.items.reduce((groups, asset) => {
      const key = `${asset.categoryId}:${asset.brand || ''}:${asset.model || asset.name}`
      const current = groups.get(key)
      if (current) {
        current.quantity += 1
      } else {
        groups.set(key, {
          categoryName: asset.category.name,
          brand: asset.brand,
          model: asset.model || asset.name,
          quantity: 1,
        })
      }
      return groups
    }, new Map<string, { categoryName: string; brand: string | null; model: string; quantity: number }>()).values(),
  )

  return (
    <div className="min-h-[calc(100svh-2.5rem)] bg-background">
      <section className="mx-auto flex w-full max-w-3xl flex-col px-5 py-12 sm:px-8 sm:py-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Waka Impression
        </p>
        <h1 className="font-hero-title text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
          哇咔印象
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{title}</p>

        <div className="mt-10 border-t border-border/70 pt-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="relative size-36 shrink-0 overflow-hidden rounded-full border border-border/70 bg-muted shadow-xl ring-8 ring-muted/40 sm:size-40">
              <Image
                src="/waka-impression-avatar.png"
                alt="哇咔印象头像"
                fill
                priority
                sizes="(min-width: 640px) 160px, 144px"
                className="object-cover"
              />
            </div>
            <div className="text-center sm:pt-5 sm:text-left">
              <h2 className="text-2xl font-semibold text-foreground">哇咔</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                一只带着相机、喜欢留下印象的哇咔。
              </p>
            </div>
          </div>
        </div>

        <section
          className="mt-12 border-t border-border/70 pt-8"
          aria-labelledby="waka-location-title"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Location
          </p>
          <h2
            id="waka-location-title"
            className="mt-3 text-2xl font-semibold text-foreground"
          >
            杭州国脉科技园
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm leading-6 text-muted-foreground">
              1幢 2楼 · A-202
            </p>
            <CopyAddressButton address="浙江省杭州市钱塘区4号大街28号国脉科技园1幢2楼 A-202" />
          </div>
          <div className="mt-6">
            <WakaLocationMap
              apiKey={amapKey}
              securityJsCode={amapSecurityCode}
            />
          </div>
        </section>

        {equipmentGroups.length > 0 && (
          <section
            className="mt-12 border-t border-border/70 pt-8"
            aria-labelledby="waka-equipment-title"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Equipment
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2
                id="waka-equipment-title"
                className="text-2xl font-semibold text-foreground"
              >
                设备清单
              </h2>
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                {equipment.items.length} 件
              </span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {equipmentGroups.map((equipmentItem) => (
                <article
                  key={`${equipmentItem.categoryName}-${equipmentItem.brand}-${equipmentItem.model}`}
                  className="rounded-2xl border border-border/70 bg-background/60 p-4 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {equipmentItem.categoryName}
                  </p>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <h3 className="font-medium text-foreground">
                      {equipmentItem.model}
                    </h3>
                    {equipmentItem.quantity > 1 && (
                      <span className="shrink-0 text-sm text-muted-foreground">
                        × {equipmentItem.quantity}
                      </span>
                    )}
                  </div>
                  {equipmentItem.brand && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {equipmentItem.brand}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </div>
  )
}
