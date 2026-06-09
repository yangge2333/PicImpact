'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Loader2, Search } from 'lucide-react'

import { Button } from '~/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '~/components/ui/chart'
import { Input } from '~/components/ui/input'
import { fetcher } from '~/lib/utils/fetcher'
import { cn } from '~/lib/utils'

type VisitChartItem = {
  date: string
  count: number
}

type VisitRecord = {
  id: string
  ip: string | null
  path: string
  userAgent: string | null
  referer: string | null
  createdAt: string
}

type VisitStatsResponse = {
  chart: VisitChartItem[]
  records: VisitRecord[]
  total: number
  page: number
  pageSize: number
  from: string
  to: string
}

const chartConfig = {
  count: {
    label: '访问量',
    color: '#8bbcf8',
  },
} satisfies ChartConfig

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - 29)
  return {
    from: formatDateInput(from),
    to: formatDateInput(to),
  }
}

function formatVisitTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export default function AdminVisitsPage() {
  const defaultRange = useMemo(() => getDefaultRange(), [])
  const [from, setFrom] = useState(defaultRange.from)
  const [to, setTo] = useState(defaultRange.to)
  const [ipDraft, setIpDraft] = useState('')
  const [ip, setIp] = useState('')
  const [page, setPage] = useState(1)

  const query = useMemo(() => {
    const params = new URLSearchParams({
      from,
      to,
      page: String(page),
      pageSize: '50',
    })

    if (ip) {
      params.set('ip', ip)
    }

    return params.toString()
  }, [from, to, ip, page])

  const { data, isLoading, isValidating } = useSWR<VisitStatsResponse>(
    `/api/v1/visits?${query}`,
    fetcher
  )

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1

  const applyFilters = () => {
    setPage(1)
    setIp(ipDraft.trim())
  }

  return (
    <div className="relative overflow-hidden px-1 py-2 sm:px-2">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-12 top-24 h-56 w-56 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute right-[-5rem] top-0 h-72 w-72 rounded-full bg-secondary blur-3xl" />
      </div>

      <div className="relative space-y-6">
        <section className="show-up-motion relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-1">
              <h1 className="font-display text-[1.55rem] leading-none text-foreground sm:text-[1.8rem]">
                网站访问统计
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                默认展示近 30 天访问量，支持按日期和 IP 过滤。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[9.5rem_9.5rem_minmax(10rem,14rem)_auto] sm:items-end">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">开始日期</span>
                <Input
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setPage(1)
                    setFrom(event.target.value)
                  }}
                  className="rounded-[0.95rem] bg-background/75"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">结束日期</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setPage(1)
                    setTo(event.target.value)
                  }}
                  className="rounded-[0.95rem] bg-background/75"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">IP 筛选</span>
                <Input
                  value={ipDraft}
                  onChange={(event) => setIpDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      applyFilters()
                    }
                  }}
                  placeholder="输入 IP 片段"
                  className="rounded-[0.95rem] bg-background/75"
                />
              </label>
              <Button onClick={applyFilters} className="rounded-[0.95rem]">
                <Search className="size-4" />
                筛选
              </Button>
            </div>
          </div>

          <div className="mt-6 rounded-[1.35rem] border border-border/70 bg-background/65 p-3 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">每日访问量</p>
                <p className="text-xs text-muted-foreground">
                  当前范围共 {data?.total ?? 0} 次访问
                </p>
              </div>
              {isValidating ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  更新中
                </span>
              ) : null}
            </div>

            <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
              <LineChart
                accessibilityLayer
                data={data?.chart ?? []}
                margin={{ top: 16, right: 16, bottom: 6, left: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={24}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-count)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </div>
        </section>

        <section className="show-up-motion relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-[1.35rem] leading-none text-foreground sm:text-[1.55rem]">
                访问记录
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">按访问时间倒序展示。</p>
            </div>
            <div className="text-xs text-muted-foreground">
              第 {page} / {totalPages} 页
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[1.2rem] border border-border/70 bg-background/60">
            <div className="hidden grid-cols-[12rem_12rem_minmax(10rem,1fr)_minmax(12rem,1.4fr)] gap-4 border-b border-border/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground lg:grid">
              <span>时间</span>
              <span>IP</span>
              <span>路径</span>
              <span>User Agent</span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在加载访问记录
              </div>
            ) : data?.records.length ? (
              <div className="divide-y divide-border/70">
                {data.records.map((record) => (
                  <div
                    key={record.id}
                    className="grid gap-2 px-4 py-3 text-sm lg:grid-cols-[12rem_12rem_minmax(10rem,1fr)_minmax(12rem,1.4fr)] lg:gap-4"
                  >
                    <div className="font-mono text-xs text-foreground/85">
                      {formatVisitTime(record.createdAt)}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {record.ip || '-'}
                    </div>
                    <div className="truncate text-foreground/85">{record.path}</div>
                    <div className="truncate text-xs text-muted-foreground" title={record.userAgent || ''}>
                      {record.userAgent || '-'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                当前筛选范围内还没有访问记录。
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              className={cn('rounded-full', page >= totalPages && 'pointer-events-none opacity-50')}
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              下一页
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
