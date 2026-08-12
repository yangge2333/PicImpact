'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, History, Loader2, Search } from 'lucide-react'

type Schedule = {
  weekday: number
  enabled: boolean
  openMinutes: number
  closeMinutes: number
}

type BookingConfig = {
  bookingWindowDays: number
  slotMinutes: number
  schedules: Schedule[]
}

type Slot = {
  startMinutes: number
  endMinutes: number
  start: string
  end: string
  available: boolean
  booked: boolean
}

type AvailabilityDay = {
  date: string
  weekday: number | null
  enabled: boolean
  slots: Slot[]
}

type DaySelection = {
  startMinutes: number | null
  endMinutes: number | null
}

type Booking = {
  id: string
  date: string
  start: string
  end: string
  contactType: string
  contactValue: string
  customerName: string | null
  note: string | null
  status: string
  adminNote: string | null
  confirmedAt: string | null
  createdAt: string
}

type ApiResponse<T> = { code: number; message: string; data: T }

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const CONTACT_OPTIONS = [
  { value: 'phone', label: '手机号', placeholder: '请输入手机号' },
  { value: 'wechat', label: '微信号', placeholder: '请输入微信号' },
  { value: 'other', label: '其他方式', placeholder: '请输入联系方式' },
]

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(value: string, days: number) {
  const date = parseDateKey(value)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(parseDateKey(value))
}

function monthKey(value: string) {
  return value.slice(0, 7)
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number)
  return `${year} 年 ${month} 月`
}

function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getMonthDays(value: string) {
  const [year, month] = value.split('-').map(Number)
  const first = new Date(year, month - 1, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const days: Array<string | null> = Array.from({ length: startOffset }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  while (days.length % 7 !== 0) {
    days.push(null)
  }
  return days
}

function statusLabel(status: string) {
  return {
    pending: '待确认',
    confirmed: '已确认',
    rejected: '未通过',
    cancelled: '已取消',
  }[status] || status
}

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!response.ok || !payload || payload.code !== 200) {
    throw new Error(payload?.message || '请求失败，请稍后重试')
  }
  return payload.data
}

export function WakaBookingClient() {
  const today = useMemo(() => dateKey(new Date()), [])
  const [config, setConfig] = useState<BookingConfig | null>(null)
  const [days, setDays] = useState<AvailabilityDay[]>([])
  const [selectedDate, setSelectedDate] = useState(today)
  const [selections, setSelections] = useState<Record<string, DaySelection>>({})
  const [visibleMonth, setVisibleMonth] = useState(monthKey(today))
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<Booking | null>(null)
  const [contactType, setContactType] = useState('phone')
  const [contactValue, setContactValue] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [historyContactType, setHistoryContactType] = useState('phone')
  const [historyContactValue, setHistoryContactValue] = useState('')
  const [history, setHistory] = useState<Booking[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  const dayMap = useMemo(() => new Map(days.map((day) => [day.date, day])), [days])
  const currentDay = dayMap.get(selectedDate)
  const monthDays = useMemo(() => getMonthDays(visibleMonth), [visibleMonth])
  const firstDate = addDays(today, -30)
  const lastDate = config ? addDays(today, config.bookingWindowDays) : today
  const selectedSelection = selections[selectedDate] || { startMinutes: null, endMinutes: null }
  const selectedStart = currentDay?.slots.find((slot) => slot.startMinutes === selectedSelection.startMinutes) || null
  const selectedEndMinutes = selectedSelection.endMinutes
  const selectedEnd = currentDay?.slots.find((slot) => slot.endMinutes === selectedEndMinutes) || null
  const currentOption = CONTACT_OPTIONS.find((option) => option.value === contactType) || CONTACT_OPTIONS[0]
  const historyOption = CONTACT_OPTIONS.find((option) => option.value === historyContactType) || CONTACT_OPTIONS[0]

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const loadedConfig = await request<BookingConfig>('/api/waka/booking/config')
        const availability = await request<{ days: AvailabilityDay[] }>(
          `/api/waka/booking/availability?from=${addDays(today, -30)}&to=${addDays(today, loadedConfig.bookingWindowDays)}`
        )
        if (!cancelled) {
          setConfig(loadedConfig)
          setDays(availability.days)
          const firstAvailable = availability.days.find((day) => day.slots.some((slot) => slot.available))
          if (firstAvailable) {
            setSelectedDate(firstAvailable.date)
            setVisibleMonth(monthKey(firstAvailable.date))
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '排班加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [today])

  function selectDate(value: string) {
    setSelectedDate(value)
    setSuccess(null)
    setError('')
  }

  function updateSelection(date: string, patch: Partial<DaySelection>) {
    setSelections((current) => ({
      ...current,
      [date]: { ...(current[date] || { startMinutes: null, endMinutes: null }), ...patch },
    }))
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStart || !selectedEndMinutes || selectedDate <= today) return
    setSubmitting(true)
    setError('')
    setSuccess(null)
    try {
      const booking = await request<Booking>('/api/waka/booking', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          startMinutes: selectedStart.startMinutes,
          endMinutes: selectedEndMinutes,
          contactType,
          contactValue,
          customerName,
          note,
        }),
      })
      setSuccess(booking)
      setContactValue('')
      setCustomerName('')
      setNote('')
      setSelections((current) => ({ ...current, [selectedDate]: { startMinutes: null, endMinutes: null } }))
      const refreshed = await request<{ days: AvailabilityDay[] }>(
        `/api/waka/booking/availability?from=${firstDate}&to=${lastDate}`
      )
      setDays(refreshed.days)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '预约失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  async function searchHistory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const records = await request<Booking[]>(
        `/api/waka/booking/history?contactType=${encodeURIComponent(historyContactType)}&contactValue=${encodeURIComponent(historyContactValue.trim())}`
      )
      setHistory(records)
    } catch (historyRequestError) {
      setHistoryError(historyRequestError instanceof Error ? historyRequestError.message : '查询失败')
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Waka Schedule</p>
          <h1 className="mt-3 font-hero-title text-4xl font-semibold leading-tight text-foreground sm:text-5xl">预约排班表</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">在半小时刻度上选择开始和结束时间，留下联系方式后提交预约，船长确认后会更新状态。</p>
        </div>
        <button
          type="button"
          onClick={() => setShowHistory((value) => !value)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <History className="size-4" />
          {showHistory ? '返回预约' : '查询我的预约'}
        </button>
      </div>

      {showHistory ? (
        <HistoryPanel
          contactType={historyContactType}
          contactValue={historyContactValue}
          option={historyOption}
          records={history}
          loading={historyLoading}
          error={historyError}
          onContactTypeChange={setHistoryContactType}
          onContactValueChange={setHistoryContactValue}
          onSubmit={searchHistory}
        />
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
            <section className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Choose a day</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">选日期</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="上一个月" onClick={() => setVisibleMonth(shiftMonth(visibleMonth, -1))} disabled={visibleMonth <= monthKey(today)} className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"><ArrowLeft className="size-4" /></button>
                  <p className="min-w-28 text-center text-sm font-medium text-foreground">{monthLabel(visibleMonth)}</p>
                  <button type="button" aria-label="下一个月" onClick={() => setVisibleMonth(shiftMonth(visibleMonth, 1))} disabled={visibleMonth >= monthKey(lastDate)} className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"><ArrowRight className="size-4" /></button>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {WEEKDAYS.map((weekday) => <span key={weekday} className="py-2">{weekday}</span>)}
                {monthDays.map((value, index) => {
                  const day = value ? dayMap.get(value) : null
                  const availableCount = day?.slots.filter((slot) => slot.available).length || 0
                  const isPast = Boolean(value && value < today)
                  const selectable = value ? (isPast || value === today ? Boolean(day) : Boolean(day?.enabled && availableCount > 0)) : false
                  return value ? (
                    <button key={value} type="button" onClick={() => selectDate(value)} disabled={!selectable} className={`group relative min-h-14 rounded-2xl p-1 text-sm transition-all ${selectedDate === value ? 'bg-foreground text-background shadow-md' : selectable ? 'text-foreground hover:bg-accent' : 'text-muted-foreground/35'}`}>
                      <span className="block pt-1">{parseDateKey(value).getDate()}</span>
                      <span className={`mt-1 block text-[0.6rem] ${selectedDate === value ? 'text-background/65' : isPast || value === today ? 'text-muted-foreground/60' : selectable ? 'text-primary' : 'text-transparent'}`}>{availableCount ? `${availableCount}档` : '—'}</span>
                    </button>
                  ) : <span key={`empty-${index}`} />
                })}
              </div>
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />有空档</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground/25" />休息日或已约满</span>
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />过去 30 天可查看，明天起可预约 {config?.bookingWindowDays || 90} 天</span>
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Available slots</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">{formatDate(selectedDate, { weekday: 'long' })}</h2>
                </div>
                <Clock3 className="mt-1 size-5 text-muted-foreground" />
              </div>
              {loading ? <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />正在读取排班</div> : currentDay?.slots.length ? <SlotGroups slots={currentDay.slots} selectedStart={selectedStart} selectedEndMinutes={selectedEndMinutes} readOnly={selectedDate <= today} onSelectStart={(slot) => { updateSelection(selectedDate, { startMinutes: slot.startMinutes, endMinutes: null }); setError('') }} onSelectEnd={(slot) => { updateSelection(selectedDate, { endMinutes: slot.endMinutes }); setError('') }} onSelectWholeDay={() => { const first = currentDay.slots[0]; const last = currentDay.slots[currentDay.slots.length - 1]; updateSelection(selectedDate, { startMinutes: first.startMinutes, endMinutes: last.endMinutes }); setError('') }} onResetSelection={() => { updateSelection(selectedDate, { startMinutes: null, endMinutes: null }); setError('') }} /> : <div className="mt-8 rounded-2xl bg-muted/45 px-4 py-10 text-center text-sm text-muted-foreground">这一天没有可预约档期，换一天看看吧。</div>}
            </section>
          </div>

          {selectedStart && selectedEnd && selectedDate > today && (
            <form onSubmit={submitBooking} className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Your booking</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">{formatDate(selectedDate)} · {selectedStart.start}–{selectedEnd.end}</h2>
                </div>
                <p className="text-xs text-muted-foreground">提交后等待船长确认</p>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-foreground">称呼（可选）<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="怎么称呼你" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40" /></label>
                <label className="text-sm text-foreground">联系方式 <span className="text-destructive">*</span><input required value={contactValue} onChange={(event) => setContactValue(event.target.value)} placeholder={currentOption.placeholder} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40" /></label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {CONTACT_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setContactType(option.value)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${contactType === option.value ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-accent'}`}>{option.label}</button>)}
              </div>
              <label className="mt-4 block text-sm text-foreground">备注（可选）<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="比如拍摄主题、人数或其他想提前说明的事" className="mt-2 w-full resize-none rounded-xl border border-border bg-background p-3 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40" /></label>
              {(error || success) && <div className={`mt-4 rounded-xl px-3 py-3 text-sm ${success ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{success ? `预约已提交：${success.date} ${success.start}–${success.end}，等待确认。` : error}</div>}
              <button type="submit" disabled={submitting} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-50 sm:w-auto">{submitting && <Loader2 className="size-4 animate-spin" />}提交预约</button>
            </form>
          )}
        </>
      )}
    </div>
  )
}

function SlotGroups({ slots, selectedStart, selectedEndMinutes, readOnly, onSelectStart, onSelectEnd, onSelectWholeDay, onResetSelection }: { slots: Slot[]; selectedStart: Slot | null; selectedEndMinutes: number | null; readOnly: boolean; onSelectStart: (slot: Slot) => void; onSelectEnd: (slot: Slot) => void; onSelectWholeDay: () => void; onResetSelection: () => void }) {
  const endOptions: Slot[] = []
  if (selectedStart) {
    let expectedStart = selectedStart.startMinutes
    for (const slot of slots.filter((item) => item.startMinutes >= selectedStart.startMinutes)) {
      if (slot.startMinutes !== expectedStart || !slot.available) break
      endOptions.push(slot)
      expectedStart = slot.endMinutes
    }
  }
  const allDayAvailable = slots.length > 0 && slots.every((slot) => slot.available)
  const selectedStartMinutes = selectedStart?.startMinutes ?? null
  return <div className="mt-7 space-y-5">
    {readOnly && <div className="rounded-xl bg-muted/45 px-3 py-3 text-sm text-muted-foreground">这是历史排班，仅供查看，不能提交预约。</div>}
    {!readOnly && <div className="flex flex-wrap items-center gap-2 rounded-xl bg-accent/45 px-3 py-3 text-sm text-muted-foreground"><span>{selectedStart ? '再选择结束时间（至少 30 分钟）' : '先选择开始时间'}</span>{selectedStart && <button type="button" onClick={onResetSelection} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent">重新选择开始时间</button>}<button type="button" disabled={!allDayAvailable} onClick={onSelectWholeDay} className="ml-auto rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40">预约全天 10:00–21:00</button></div>}
    {selectedStart && !readOnly && <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-foreground">开始时间：<span className="font-semibold">{selectedStart.start}</span>{selectedEndMinutes ? <><span className="mx-2 text-muted-foreground">至</span><span className="font-semibold">{slots.find((slot) => slot.endMinutes === selectedEndMinutes)?.end}</span></> : <span className="ml-2 text-muted-foreground">请选择结束时间</span>}</div>}
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/70">
      <div className="grid grid-cols-[4.5rem_1fr] border-b border-border/70 bg-muted/25 px-3 py-2 text-xs text-muted-foreground"><span>时间</span><span>{selectedStart ? '点击时间格选择结束时间' : '点击时间格选择开始时间'}</span></div>
      <div className="max-h-[31rem] overflow-y-auto">
        {slots.map((slot) => {
          const isSelectedStart = selectedStartMinutes === slot.startMinutes
          const isSelectedRange = selectedStartMinutes !== null && selectedEndMinutes !== null && slot.startMinutes >= selectedStartMinutes && slot.endMinutes <= selectedEndMinutes
          const canChooseEnd = Boolean(selectedStart && endOptions.some((option) => option.endMinutes === slot.endMinutes))
          const canChoose = !readOnly && (slot.available || canChooseEnd)
          return <div key={slot.start} className="grid min-h-12 grid-cols-[4.5rem_1fr] border-b border-border/60 last:border-b-0">
            <div className="flex items-start justify-end border-r border-border/60 px-3 py-2 text-xs tabular-nums text-muted-foreground">{slot.start}</div>
            <button type="button" disabled={!canChoose} onClick={() => {
              if (!selectedStart) {
                onSelectStart(slot)
              } else if (slot.startMinutes === selectedStart.startMinutes && canChooseEnd) {
                onSelectEnd(slot)
              } else if (slot.startMinutes < selectedStart.startMinutes) {
                onSelectStart(slot)
              } else if (canChooseEnd) {
                onSelectEnd(slot)
              }
            }} className={`m-1 flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${isSelectedStart ? 'bg-foreground text-background' : isSelectedRange ? 'bg-primary/15 text-primary' : slot.booked ? 'cursor-not-allowed bg-muted/65 text-muted-foreground/55' : slot.available ? 'text-foreground hover:bg-accent' : 'cursor-not-allowed bg-muted/30 text-muted-foreground/35'}`}>
              <span>{slot.booked ? '已预约' : isSelectedStart ? '开始时间' : isSelectedRange ? '已选时间段' : slot.available ? '可预约' : '不可预约'}</span>
              <span className="text-xs tabular-nums opacity-75">{slot.end}</span>
            </button>
          </div>
        })}
      </div>
      {selectedStart && !readOnly && <div className="border-t border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">结束边界可选至：{endOptions.length ? `${endOptions[0].end}–${endOptions[endOptions.length - 1].end}` : '暂无连续空档'}</div>}
    </div>
  </div>
}

function HistoryPanel({ contactType, contactValue, option, records, loading, error, onContactTypeChange, onContactValueChange, onSubmit }: { contactType: string; contactValue: string; option: (typeof CONTACT_OPTIONS)[number]; records: Booking[]; loading: boolean; error: string; onContactTypeChange: (value: string) => void; onContactValueChange: (value: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm sm:p-8"><div className="mx-auto max-w-xl"><div className="text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Search className="size-5" /></div><h2 className="mt-4 text-2xl font-semibold text-foreground">查找我的预约</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">输入预约时留下的联系方式，只会看到与它匹配的预约记录。</p></div><form onSubmit={onSubmit} className="mt-7"><div className="flex flex-wrap justify-center gap-2">{CONTACT_OPTIONS.map((item) => <button key={item.value} type="button" onClick={() => onContactTypeChange(item.value)} className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${contactType === item.value ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-accent'}`}>{item.label}</button>)}</div><input required value={contactValue} onChange={(event) => onContactValueChange(event.target.value)} placeholder={option.placeholder} className="mt-4 h-12 w-full rounded-xl border border-border bg-background px-4 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40" /><button type="submit" disabled={loading} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-50">{loading && <Loader2 className="size-4 animate-spin" />}查询预约</button></form>{error && <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-3 text-sm text-destructive">{error}</p>}</div><div className="mx-auto mt-8 max-w-2xl space-y-3">{records.length === 0 && !loading ? <div className="rounded-xl border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">还没有查询到预约记录。</div> : records.map((record) => <div key={record.id} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/65 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-foreground">{formatDate(record.date)} · {record.start}–{record.end}</p><p className="mt-1 text-xs text-muted-foreground">提交于 {new Date(record.createdAt).toLocaleString('zh-CN')}</p></div><span className={`inline-flex w-fit rounded-lg px-2.5 py-1 text-xs ${record.status === 'confirmed' ? 'bg-primary/10 text-primary' : record.status === 'rejected' || record.status === 'cancelled' ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground'}`}>{statusLabel(record.status)}</span></div>)}</div></section>
}
