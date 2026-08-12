'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, History, Loader2, Search } from 'lucide-react'

type Schedule = {
  weekday: number
  enabled: boolean
  openMinutes: number
  closeMinutes: number
}

type Studio = { id: string; name: string }

type BookingConfig = {
  bookingWindowDays: number
  slotMinutes: number
  schedules: Schedule[]
  studios: Studio[]
}

type Slot = {
  startMinutes: number
  endMinutes: number
  start: string
  end: string
  available: boolean
  booked: boolean
  customerName: string | null
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

type SelectedRange = {
  date: string
  startMinutes: number
  endMinutes: number
  start: string
  end: string
}

type Booking = {
  id: string
  studioId: string
  studioName: string | null
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

function getWeekDays(value: string) {
  const date = parseDateKey(value)
  const offset = (date.getDay() + 6) % 7
  return Array.from({ length: 7 }, (_, index) => addDays(value, index - offset))
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
  const [studioId, setStudioId] = useState('')
  const [selections, setSelections] = useState<Record<string, DaySelection>>({})
  const [visibleMonth, setVisibleMonth] = useState(monthKey(today))
  const [calendarExpanded, setCalendarExpanded] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<Booking[] | null>(null)
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
  const calendarDays = useMemo(() => calendarExpanded ? monthDays : getWeekDays(selectedDate), [calendarExpanded, monthDays, selectedDate])
  const firstDate = addDays(today, -30)
  const bookingWindowDays = config?.bookingWindowDays || 0
  const lastDate = config ? addDays(today, config.bookingWindowDays) : today
  const selectedSelection = selections[selectedDate] || { startMinutes: null, endMinutes: null }
  const selectedStart = currentDay?.slots.find((slot) => slot.startMinutes === selectedSelection.startMinutes) || null
  const selectedEndMinutes = selectedSelection.endMinutes
  const selectedRanges = useMemo<SelectedRange[]>(() => days.flatMap((day) => {
    if (day.date < today) return []
    const selection = selections[day.date]
    if (selection?.startMinutes === null || selection?.startMinutes === undefined || selection.endMinutes === null || selection.endMinutes === undefined) return []
    const start = day.slots.find((slot) => slot.startMinutes === selection.startMinutes)
    const end = day.slots.find((slot) => slot.endMinutes === selection.endMinutes)
    return start && end && end.endMinutes > start.startMinutes ? [{ date: day.date, startMinutes: start.startMinutes, endMinutes: end.endMinutes, start: start.start, end: end.end }] : []
  }), [days, selections, today])
  const currentOption = CONTACT_OPTIONS.find((option) => option.value === contactType) || CONTACT_OPTIONS[0]
  const historyOption = CONTACT_OPTIONS.find((option) => option.value === historyContactType) || CONTACT_OPTIONS[0]

  useEffect(() => {
    setCalendarExpanded(window.matchMedia('(min-width: 768px)').matches)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const loadedConfig = await request<BookingConfig>('/api/waka/booking/config')
        if (!cancelled) {
          setConfig(loadedConfig)
          setStudioId((current) => current || loadedConfig.studios[0]?.id || '')
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

  useEffect(() => {
    if (!bookingWindowDays || !studioId) return
    let cancelled = false
    async function loadAvailability() {
      try {
        const availability = await request<{ days: AvailabilityDay[] }>(
          `/api/waka/booking/availability?studioId=${encodeURIComponent(studioId)}&from=${addDays(today, -30)}&to=${addDays(today, bookingWindowDays)}`
        )
        if (!cancelled) {
          setDays(availability.days)
          const firstAvailable = availability.days.find((day) => day.slots.some((slot) => slot.available))
          if (firstAvailable && !availability.days.some((day) => day.date === selectedDate)) {
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
    setLoading(true)
    void loadAvailability()
    return () => {
      cancelled = true
    }
  }, [bookingWindowDays, studioId, today])

  function selectDate(value: string) {
    setSelectedDate(value)
    setVisibleMonth(monthKey(value))
    setSuccess(null)
    setError('')
  }

  function selectStudio(value: string) {
    if (value === studioId) return
    setStudioId(value)
    setSelections({})
    setSuccess(null)
    setError('')
  }

  function shiftWeek(amount: number) {
    const nextDate = addDays(selectedDate, amount * 7)
    if (nextDate < firstDate || nextDate > lastDate) return
    selectDate(nextDate)
  }

  function updateSelection(date: string, patch: Partial<DaySelection>) {
    setSelections((current) => ({
      ...current,
      [date]: { ...(current[date] || { startMinutes: null, endMinutes: null }), ...patch },
    }))
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRanges.length) return
    setSubmitting(true)
    setError('')
    setSuccess(null)
    try {
      const response = await request<Booking | Booking[]>('/api/waka/booking', {
        method: 'POST',
        body: JSON.stringify({
          studioId,
          selections: selectedRanges.map((range) => ({ date: range.date, startMinutes: range.startMinutes, endMinutes: range.endMinutes })),
          contactType,
          contactValue,
          customerName,
          note,
        }),
      })
      const bookings = Array.isArray(response) ? response : [response]
      setSuccess(bookings)
      setContactValue('')
      setCustomerName('')
      setNote('')
      setSelections((current) => {
        const next = { ...current }
        selectedRanges.forEach((range) => { next[range.date] = { startMinutes: null, endMinutes: null } })
        return next
      })
      const refreshed = await request<{ days: AvailabilityDay[] }>(
        `/api/waka/booking/availability?studioId=${encodeURIComponent(studioId)}&from=${firstDate}&to=${lastDate}`
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Waka Schedule</p>
          </div>
          <h1 className="mt-3 font-hero-title text-4xl font-semibold leading-tight text-foreground sm:text-5xl">排期</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">按小时选择开始和结束时间，留下联系方式后提交预约，船长确认后会更新状态。</p>
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
                {calendarExpanded ? <div className="flex items-center gap-1"><button type="button" aria-label="上一个月" onClick={() => setVisibleMonth(shiftMonth(visibleMonth, -1))} disabled={visibleMonth <= monthKey(today)} className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"><ArrowLeft className="size-4" /></button><p className="min-w-28 text-center text-sm font-medium text-foreground">{monthLabel(visibleMonth)}</p><button type="button" aria-label="下一个月" onClick={() => setVisibleMonth(shiftMonth(visibleMonth, 1))} disabled={visibleMonth >= monthKey(lastDate)} className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"><ArrowRight className="size-4" /></button><button type="button" onClick={() => setCalendarExpanded(false)} className="ml-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent">收起</button></div> : <button type="button" onClick={() => setCalendarExpanded(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"><CalendarDays className="size-3.5" />展开日历</button>}
              </div>
              <div className="relative mt-6 px-5">
                {!calendarExpanded && <button type="button" aria-label="上一周" onClick={() => shiftWeek(-1)} disabled={selectedDate <= firstDate} className="absolute left-0 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"><ArrowLeft className="size-4" /></button>}
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                  {WEEKDAYS.map((weekday) => <span key={weekday} className="py-2">{weekday}</span>)}
                  {calendarDays.map((value, index) => {
                    const day = value ? dayMap.get(value) : null
                    const availableCount = day?.slots.filter((slot) => slot.available).length || 0
                    const isPast = Boolean(value && value < today)
                    const isToday = value === today
                    const selectable = value ? (isPast || value === today ? Boolean(day) : Boolean(day?.enabled && availableCount > 0)) : false
                    return value ? (
                      <button key={value} type="button" aria-current={isToday ? 'date' : undefined} onClick={() => selectDate(value)} disabled={!selectable} className={`group relative min-h-14 rounded-2xl border p-1 text-sm transition-all ${selectedDate === value ? 'border-foreground bg-foreground text-background shadow-md' : isToday ? 'border-foreground/45 text-foreground' : 'border-transparent'} ${selectable && selectedDate !== value ? 'hover:bg-accent' : ''} ${!selectable && selectedDate !== value ? 'text-muted-foreground/35' : ''}`}>
                        <span className="block pt-1">{parseDateKey(value).getDate()}</span>
                      </button>
                    ) : <span key={`empty-${index}`} />
                  })}
                </div>
                {!calendarExpanded && <button type="button" aria-label="下一周" onClick={() => shiftWeek(1)} disabled={addDays(selectedDate, 7) > lastDate} className="absolute right-0 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"><ArrowRight className="size-4" /></button>}
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
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {config?.studios.map((studio) => <button key={studio.id} type="button" onClick={() => selectStudio(studio.id)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${studio.id === studioId ? 'border-foreground bg-foreground text-background' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>{studio.name}</button>)}
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">{formatDate(selectedDate, { weekday: 'long' })}</h2>
                </div>
                <Clock3 className="mt-1 size-5 text-muted-foreground" />
              </div>
              {loading ? <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />正在读取排班</div> : currentDay?.slots.length ? <SlotGroups slots={currentDay.slots} selectedStart={selectedStart} selectedEndMinutes={selectedEndMinutes} readOnly={selectedDate < today} onSelectStart={(slot) => { updateSelection(selectedDate, { startMinutes: slot.startMinutes, endMinutes: null }); setError('') }} onSelectEnd={(slot) => { updateSelection(selectedDate, { endMinutes: slot.endMinutes }); setError('') }} onMoveStart={(slot) => updateSelection(selectedDate, { startMinutes: slot.startMinutes })} onMoveEnd={(slot) => updateSelection(selectedDate, { endMinutes: slot.endMinutes })} onSelectWholeDay={() => { const first = currentDay.slots[0]; const last = currentDay.slots[currentDay.slots.length - 1]; updateSelection(selectedDate, { startMinutes: first.startMinutes, endMinutes: last.endMinutes }); setError('') }} onResetSelection={() => { updateSelection(selectedDate, { startMinutes: null, endMinutes: null }); setError('') }} /> : <div className="mt-8 rounded-2xl bg-muted/45 px-4 py-10 text-center text-sm text-muted-foreground">这一天没有可预约档期，换一天看看吧。</div>}
            </section>
          </div>

          <form onSubmit={submitBooking} className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Your booking</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">{selectedRanges.length === 0 ? '请选择一个时间段' : selectedRanges.length === 1 ? '已选择一个时间段' : `已选择 ${selectedRanges.length} 个时间段`}</h2>
                </div>
                <p className="text-xs text-muted-foreground">提交后等待船长确认</p>
              </div>
              <div className="mt-4 flex min-h-7 flex-wrap items-center gap-2">{selectedRanges.length > 0 ? selectedRanges.map((range) => <span key={range.date} className="rounded-lg bg-muted/60 px-3 py-1.5 text-xs text-foreground">{formatDate(range.date)} · {range.start}–{range.end}</span>) : <p className="text-sm text-muted-foreground">请先在右侧选择开始和结束时间。</p>}</div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-foreground">称呼（CN） <span className="text-destructive">*</span><input required value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="怎么称呼你" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40" /></label>
                <label className="text-sm text-foreground">联系方式 <span className="text-destructive">*</span><input required value={contactValue} onChange={(event) => setContactValue(event.target.value)} placeholder={currentOption.placeholder} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40" /></label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {CONTACT_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setContactType(option.value)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${contactType === option.value ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-accent'}`}>{option.label}</button>)}
              </div>
              <label className="mt-4 block text-sm text-foreground">备注（可选）<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="比如拍摄主题、人数或其他想提前说明的事" className="mt-2 w-full resize-none rounded-xl border border-border bg-background p-3 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40" /></label>
              {(error || success) && <div className={`mt-4 rounded-xl px-3 py-3 text-sm ${success ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{success ? `已提交 ${success.length} 天预约，等待船长确认。` : error}</div>}
              <button type="submit" disabled={submitting || selectedRanges.length === 0} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-50 sm:w-auto">{submitting && <Loader2 className="size-4 animate-spin" />}提交预约</button>
            </form>
        </>
      )}
    </div>
  )
}

function SlotGroups({ slots, selectedStart, selectedEndMinutes, readOnly, onSelectStart, onSelectEnd, onMoveStart, onMoveEnd, onSelectWholeDay, onResetSelection }: { slots: Slot[]; selectedStart: Slot | null; selectedEndMinutes: number | null; readOnly: boolean; onSelectStart: (slot: Slot) => void; onSelectEnd: (slot: Slot) => void; onMoveStart: (slot: Slot) => void; onMoveEnd: (slot: Slot) => void; onSelectWholeDay: () => void; onResetSelection: () => void }) {
  const [draggingEdge, setDraggingEdge] = useState<'start' | 'end' | null>(null)
  const endOptions: Slot[] = []
  if (selectedStart) {
    let expectedStart = selectedStart.startMinutes
    for (const slot of slots.filter((item) => item.startMinutes >= selectedStart.startMinutes)) {
      if (slot.startMinutes !== expectedStart || !slot.available) break
      if (slot.endMinutes > selectedStart.startMinutes) endOptions.push(slot)
      expectedStart = slot.endMinutes
    }
  }
  const allDayAvailable = slots.length > 0 && slots.every((slot) => slot.available)
  const selectedStartMinutes = selectedStart?.startMinutes ?? null
  const canUseRange = (startMinutes: number, endMinutes: number) => {
    if (endMinutes <= startMinutes) return false
    const rangeSlots = slots.filter((slot) => slot.startMinutes >= startMinutes && slot.endMinutes <= endMinutes)
    return rangeSlots.length > 0 && rangeSlots[0].startMinutes === startMinutes && rangeSlots[rangeSlots.length - 1].endMinutes === endMinutes && rangeSlots.every((slot) => slot.available)
  }

  useEffect(() => {
    if (!draggingEdge) return
    function moveEdge(event: PointerEvent) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot-start]')
      const slotStart = target?.dataset.slotStart
      const slot = slotStart ? slots.find((item) => item.startMinutes === Number(slotStart)) : null
      if (!slot || !slot.available) return
      if (draggingEdge === 'start' && selectedEndMinutes !== null && canUseRange(slot.startMinutes, selectedEndMinutes)) {
        onMoveStart(slot)
      }
      if (draggingEdge === 'end' && selectedStartMinutes !== null && canUseRange(selectedStartMinutes, slot.endMinutes)) {
        onMoveEnd(slot)
      }
    }
    function stopDragging() {
      setDraggingEdge(null)
    }
    window.addEventListener('pointermove', moveEdge)
    window.addEventListener('pointerup', stopDragging)
    return () => {
      window.removeEventListener('pointermove', moveEdge)
      window.removeEventListener('pointerup', stopDragging)
    }
  }, [draggingEdge, onMoveEnd, onMoveStart, selectedEndMinutes, selectedStartMinutes, slots])

  return <div className="mt-6 space-y-4">
    {readOnly && <div className="rounded-lg border border-border/60 bg-muted/35 px-3.5 py-3 text-sm text-muted-foreground">这是历史排班，仅供查看，不能提交预约。</div>}
    {!readOnly && <div className="rounded-xl border border-border/70 bg-background px-4 py-3.5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{selectedStart ? '正在设置预约时段' : '选择预约时段'}</p><p className="mt-1 text-sm font-semibold text-foreground">{selectedStart ? <><span>{selectedStart.start}</span><span className="mx-2 text-muted-foreground">至</span>{selectedEndMinutes ? <span>{slots.find((slot) => slot.endMinutes === selectedEndMinutes)?.end}</span> : <span className="font-normal text-muted-foreground">请选择结束时间</span>}</> : '先点击一个空档开始选择'}</p></div><div className="flex shrink-0 items-center gap-2">{selectedStart && <button type="button" onClick={onResetSelection} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent">改选开始</button>}<button type="button" disabled={!allDayAvailable} onClick={onSelectWholeDay} className="rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40">预约全天</button></div></div></div>}
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background/70">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/20 px-4 py-3"><div><p className="text-xs font-medium text-foreground">时间安排</p><p className="mt-0.5 text-[11px] text-muted-foreground">{selectedStart ? '选择结束时间' : '选择开始时间'}</p></div><span className="text-[11px] tabular-nums text-muted-foreground">每格 1 小时</span></div>
      <div className="max-h-[31rem] overflow-y-auto p-2 sm:p-3">
        <div className="space-y-2">
          {slots.map((slot) => {
            const isSelectedStart = selectedStartMinutes === slot.startMinutes
            const isSelectedRange = selectedStartMinutes !== null && selectedEndMinutes !== null && slot.startMinutes >= selectedStartMinutes && slot.endMinutes <= selectedEndMinutes
            const canChooseEnd = Boolean(selectedStart && endOptions.some((option) => option.endMinutes === slot.endMinutes))
            const canChoose = !readOnly && (slot.available || canChooseEnd)
            const status = slot.booked ? '已预约' : isSelectedStart ? '开始时间' : isSelectedRange ? '已选时间段' : slot.available ? '可预约' : '不可预约'
            const tone = isSelectedStart ? 'border-foreground bg-foreground text-background shadow-sm' : isSelectedRange ? 'border-accent-foreground/20 bg-accent text-accent-foreground' : slot.booked ? 'border-border/60 bg-muted/60 text-muted-foreground' : slot.available ? 'border-border/70 bg-background text-foreground hover:border-foreground/30 hover:bg-accent/40' : 'border-border/40 bg-muted/25 text-muted-foreground/45'
            return <div key={slot.start} data-slot-start={slot.startMinutes} className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-stretch gap-2 sm:gap-3">
              <div className="flex flex-col justify-center px-1 text-right"><span className="text-xs font-medium tabular-nums text-foreground">{slot.start}</span><span className="mt-1 text-[11px] tabular-nums text-muted-foreground">至 {slot.end}</span></div>
              <button type="button" disabled={!canChoose} aria-label={`${slot.start} 至 ${slot.end}，${status}${slot.customerName ? `，CN：${slot.customerName}` : ''}`} onClick={() => {
                if (!selectedStart) {
                  onSelectStart(slot)
                } else if (slot.startMinutes === selectedStart.startMinutes && canChooseEnd) {
                  onSelectEnd(slot)
                } else if (slot.startMinutes < selectedStart.startMinutes) {
                  onSelectStart(slot)
                } else if (canChooseEnd) {
                  onSelectEnd(slot)
                }
              }} className={`group relative flex min-h-14 items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-all disabled:cursor-default ${tone}`}>
                <div className="flex min-w-0 items-center gap-2.5"><span aria-hidden className={`size-2 shrink-0 rounded-full ${isSelectedStart ? 'bg-background' : isSelectedRange ? 'bg-accent-foreground/70' : slot.booked ? 'bg-muted-foreground/40' : slot.available ? 'bg-primary' : 'bg-muted-foreground/25'}`} /><div className="min-w-0"><p className="font-medium">{status}</p>{slot.booked && slot.customerName && <p className="mt-1 truncate text-xs text-current/70">CN：{slot.customerName}</p>}</div></div>
                {!slot.booked && <span className="shrink-0 text-[11px] text-current/60">{isSelectedStart ? '拖动调整' : slot.available ? '点击选择' : ''}</span>}
                {!readOnly && selectedEndMinutes !== null && isSelectedStart && <span aria-label="拖动开始时间" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); setDraggingEdge('start') }} className="absolute -left-1.5 top-1/2 z-20 size-3 -translate-y-1/2 cursor-ns-resize touch-none rounded-full border-2 border-background bg-foreground shadow-sm" />}
                {!readOnly && selectedEndMinutes === slot.endMinutes && <span aria-label="拖动结束时间" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); setDraggingEdge('end') }} className="absolute -right-1.5 top-1/2 z-20 size-3 -translate-y-1/2 cursor-ns-resize touch-none rounded-full border-2 border-background bg-foreground shadow-sm" />}
              </button>
            </div>
          })}
        </div>
      </div>
      {selectedStart && !readOnly && <div className="border-t border-border/70 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">结束时间可选至：{endOptions.length ? `${endOptions[0].end}–${endOptions[endOptions.length - 1].end}` : '暂无连续空档'}</div>}
    </div>
  </div>
}

function HistoryPanel({ contactType, contactValue, option, records, loading, error, onContactTypeChange, onContactValueChange, onSubmit }: { contactType: string; contactValue: string; option: (typeof CONTACT_OPTIONS)[number]; records: Booking[]; loading: boolean; error: string; onContactTypeChange: (value: string) => void; onContactValueChange: (value: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm sm:p-8"><div className="mx-auto max-w-xl"><div className="text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Search className="size-5" /></div><h2 className="mt-4 text-2xl font-semibold text-foreground">查找我的预约</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">输入预约时留下的联系方式，只会看到与它匹配的预约记录。</p></div><form onSubmit={onSubmit} className="mt-7"><div className="flex flex-wrap justify-center gap-2">{CONTACT_OPTIONS.map((item) => <button key={item.value} type="button" onClick={() => onContactTypeChange(item.value)} className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${contactType === item.value ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-accent'}`}>{item.label}</button>)}</div><input required value={contactValue} onChange={(event) => onContactValueChange(event.target.value)} placeholder={option.placeholder} className="mt-4 h-12 w-full rounded-xl border border-border bg-background px-4 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40" /><button type="submit" disabled={loading} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-50">{loading && <Loader2 className="size-4 animate-spin" />}查询预约</button></form>{error && <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-3 text-sm text-destructive">{error}</p>}</div><div className="mx-auto mt-8 max-w-2xl space-y-3">{records.length === 0 && !loading ? <div className="rounded-xl border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">还没有查询到预约记录。</div> : records.map((record) => <div key={record.id} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/65 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-foreground">{formatDate(record.date)} · {record.start}–{record.end}</p>{record.studioName && <span className="rounded-md bg-muted px-2 py-1 text-xs text-foreground">{record.studioName}</span>}</div><p className="mt-1 text-xs text-muted-foreground">提交于 {new Date(record.createdAt).toLocaleString('zh-CN')}</p></div><span className={`inline-flex w-fit rounded-lg px-2.5 py-1 text-xs ${record.status === 'confirmed' ? 'bg-primary/10 text-primary' : record.status === 'rejected' || record.status === 'cancelled' ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground'}`}>{statusLabel(record.status)}</span></div>)}</div></section>
}
