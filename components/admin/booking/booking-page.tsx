'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, ChevronDown, Loader2, Plus, Save, Trash2, X } from 'lucide-react'

type Schedule = { weekday: number; enabled: boolean; openMinutes: number; closeMinutes: number }
type Studio = { id: string; name: string; enabled: boolean; sort: number }
type Settings = { id: string; bookingWindowDays: number; slotMinutes: number; schedules: Schedule[]; closedDates: string[]; studios: Studio[] }
type Booking = { id: string; studioId: string; studioName: string | null; date: string; start: string; end: string; contactType: string; contactValue: string; customerName: string | null; note: string | null; status: string; adminNote: string | null; confirmedAt: string | null; createdAt: string }
type CreateSelection = { id: number; studioId: string; date: string; startMinutes: number; endMinutes: number }
type CreateForm = { selections: CreateSelection[]; contactType: string; contactValue: string; customerName: string; note: string }
type ApiResponse<T> = { code: number; message: string; data: T }

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const TIME_OPTIONS = Array.from({ length: 25 }, (_, index) => {
  const minutes = index * 60
  return { minutes, label: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}` }
})
const CONTACT_OPTIONS = [
  { value: 'phone', label: '手机号' },
  { value: 'wechat', label: '微信号' },
  { value: 'other', label: '其他方式' },
]

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!response.ok || !payload || payload.code !== 200) throw new Error(payload?.message || '请求失败')
  return payload.data
}

function startOfToday() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function initialCreateForm(studioId = ''): CreateForm {
  return {
    selections: [{ id: 1, studioId, date: addDays(startOfToday(), 1), startMinutes: 600, endMinutes: 660 }],
    contactType: 'phone',
    contactValue: '',
    customerName: '',
    note: '',
  }
}

function statusLabel(status: string) {
  return { pending: '待确认', confirmed: '已确认', rejected: '未通过', cancelled: '已取消' }[status] || status
}

export default function BookingPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workingId, setWorkingId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [closedDate, setClosedDate] = useState(() => addDays(startOfToday(), 1))
  const [newStudioName, setNewStudioName] = useState('')
  const [createForm, setCreateForm] = useState<CreateForm>(initialCreateForm)

  const visibleBookings = useMemo(() => activeTab === 'pending' ? bookings.filter((booking) => booking.status === 'pending') : bookings, [activeTab, bookings])

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const today = startOfToday()
      const [loadedSettings, loadedBookings] = await Promise.all([
        request<Settings>('/api/v1/booking/settings'),
        request<Booking[]>(`/api/v1/booking/reservations?from=${today}&to=${addDays(today, 90)}`),
      ])
      setSettings(loadedSettings)
      setCreateForm((current) => ({
        ...current,
        selections: current.selections.map((selection) => ({ ...selection, studioId: selection.studioId || loadedSettings.studios.find((studio) => studio.enabled)?.id || '' })),
      }))
      setBookings(loadedBookings)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  function updateSchedule(weekday: number, patch: Partial<Schedule>) {
    setSettings((current) => current ? { ...current, schedules: current.schedules.map((schedule) => schedule.weekday === weekday ? { ...schedule, ...patch } : schedule) } : current)
  }

  function addClosedDate() {
    if (!settings || !closedDate) return
    if (settings.closedDates.includes(closedDate)) {
      setError('这个日期已经设置为休息日')
      return
    }
    setError('')
    setSettings((current) => current ? { ...current, closedDates: [...current.closedDates, closedDate].sort() } : current)
  }

  function removeClosedDate(date: string) {
    setSettings((current) => current ? { ...current, closedDates: current.closedDates.filter((item) => item !== date) } : current)
  }

  function addStudio() {
    const name = newStudioName.trim()
    if (!settings || !name) return
    if (settings.studios.some((studio) => studio.name === name)) {
      setError('棚子名称不能重复')
      return
    }
    setError('')
    setSettings((current) => current ? { ...current, studios: [...current.studios, { id: `new-${Date.now()}`, name, enabled: true, sort: current.studios.length }] } : current)
    setNewStudioName('')
  }

  function removeStudio(id: string) {
    setSettings((current) => {
      if (!current || current.studios.filter((studio) => studio.enabled).length <= 1) {
        setError('至少保留一个可用棚子')
        return current
      }
      return { ...current, studios: current.studios.filter((studio) => studio.id !== id) }
    })
  }

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const saved = await request<Settings>('/api/v1/booking/settings', { method: 'PUT', body: JSON.stringify({ bookingWindowDays: settings.bookingWindowDays, schedules: settings.schedules, closedDates: settings.closedDates, studios: settings.studios }) })
      setSettings(saved)
      setCreateForm((current) => ({
        ...current,
        selections: current.selections.map((selection) => {
          const localStudio = settings.studios.find((studio) => studio.id === selection.studioId)
          const savedStudio = saved.studios.find((studio) => studio.name === localStudio?.name)
          return { ...selection, studioId: savedStudio?.id || selection.studioId }
        }),
      }))
      setMessage('排班设置已保存')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: 'confirmed' | 'rejected') {
    setWorkingId(id)
    setError('')
    setMessage('')
    try {
      const updated = await request<Booking>(`/api/v1/booking/reservations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setBookings((current) => current.map((booking) => booking.id === id ? updated : booking))
      setMessage(status === 'confirmed' ? '预约已确认' : '预约已拒绝')
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : '操作失败')
    } finally {
      setWorkingId('')
    }
  }

  async function createReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setError('')
    setMessage('')
    try {
      const created = await request<Booking[]>('/api/v1/booking/reservations', { method: 'POST', body: JSON.stringify(createForm) })
      setBookings((current) => [...current, ...created].sort((left, right) => `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`)))
      setCreateForm(initialCreateForm(settings?.studios.find((studio) => studio.enabled)?.id || ''))
      setShowCreate(false)
      setMessage(`已添加 ${created.length} 条预约记录`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '添加失败')
    } finally {
      setCreating(false)
    }
  }

  async function deleteReservation(id: string) {
    setDeletingId(id)
    setError('')
    setMessage('')
    try {
      await request<{ id: string }>(`/api/v1/booking/reservations/${id}`, { method: 'DELETE' })
      setBookings((current) => current.filter((booking) => booking.id !== id))
      setMessage('预约记录已删除')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败')
    } finally {
      setDeletingId('')
    }
  }

  return <div className="relative space-y-6 px-1 py-2 sm:px-2"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Waka Booking</p><h1 className="mt-2 font-display text-3xl text-foreground">预约排班</h1><p className="mt-2 text-sm text-muted-foreground">配置营业时间，处理哇咔印象的预约请求。</p></div><button type="button" onClick={() => void load()} className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm hover:bg-accent"><CalendarClock className="size-4" />刷新</button></div>{(error || message) && <div className={`rounded-2xl px-4 py-3 text-sm ${error ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>{error || message}</div>}
     <section className="rounded-[1.5rem] border border-border/70 bg-card/70 p-4 shadow-sm sm:p-6"><div className="flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Opening hours</p><h2 className="mt-2 text-xl font-semibold">营业时间</h2></div><label className="flex items-center gap-3 text-sm">可预约天数<input type="number" min={1} max={90} value={settings?.bookingWindowDays || ''} onChange={(event) => setSettings((current) => current ? { ...current, bookingWindowDays: Number(event.target.value) } : current)} className="h-9 w-24 rounded-lg border border-border bg-background px-3" /><span className="text-muted-foreground">天</span></label></div>{loading || !settings ? <div className="flex min-h-36 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />正在加载设置</div> : <div className="mt-5 space-y-2">{settings.schedules.map((schedule) => <ScheduleRow key={schedule.weekday} schedule={schedule} label={WEEKDAYS[schedule.weekday - 1]} onChange={(patch) => updateSchedule(schedule.weekday, patch)} />)}</div>}<div className="mt-5 rounded-xl border border-border/70 bg-background/60 p-4"><div><p className="text-sm font-medium text-foreground">棚子</p><p className="mt-1 text-xs text-muted-foreground">每个棚子拥有独立的预约时间表，新增后会出现在公开预约页的时间选择器。</p></div><div className="mt-3 flex flex-wrap gap-2"><input value={newStudioName} onChange={(event) => setNewStudioName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addStudio() } }} placeholder="输入棚子名称" className="h-9 min-w-48 flex-1 rounded-lg border border-border bg-background px-3 text-sm" /><button type="button" disabled={!settings || !newStudioName.trim()} onClick={addStudio} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50"><Plus className="size-3.5" />添加棚子</button></div><div className="mt-3 flex flex-wrap gap-2">{settings?.studios.filter((studio) => studio.enabled).map((studio) => <span key={studio.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground">{studio.name}<button type="button" onClick={() => removeStudio(studio.id)} aria-label={`移除 ${studio.name}`} className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"><X className="size-3" /></button></span>)}</div></div><div className="mt-5 rounded-xl border border-border/70 bg-background/60 p-4"><div><p className="text-sm font-medium text-foreground">指定休息日</p><p className="mt-1 text-xs text-muted-foreground">添加临时不营业日期，公开日历将无法预约这些日期。</p></div><div className="mt-3 flex flex-wrap gap-2"><input type="date" value={closedDate} onChange={(event) => setClosedDate(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm" /><button type="button" disabled={!settings} onClick={addClosedDate} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50"><Plus className="size-3.5" />添加休息日</button></div>{settings?.closedDates.length ? <div className="mt-3 flex flex-wrap gap-2">{settings.closedDates.map((date) => <span key={date} className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground">{date}<button type="button" onClick={() => removeClosedDate(date)} aria-label={`移除 ${date}`} className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"><X className="size-3" /></button></span>)}</div> : <p className="mt-3 text-xs text-muted-foreground">暂未设置指定休息日。</p>}</div><div className="mt-5 flex justify-end"><button type="button" disabled={saving || !settings} onClick={() => void saveSettings()} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}保存排班设置</button></div></section>
    <section className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm sm:p-6"><div className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reservations</p><h2 className="mt-2 text-xl font-semibold">预约记录 <span className="ml-1 text-sm font-normal text-muted-foreground">{bookings.length}</span></h2></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl border border-border p-1 text-xs"><button type="button" onClick={() => setActiveTab('pending')} className={`rounded-lg px-3 py-1.5 ${activeTab === 'pending' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>待确认 {bookings.filter((booking) => booking.status === 'pending').length}</button><button type="button" onClick={() => setActiveTab('all')} className={`rounded-lg px-3 py-1.5 ${activeTab === 'all' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>全部</button></div><button type="button" onClick={() => setShowCreate((current) => !current)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-foreground px-3 text-xs font-medium text-background hover:opacity-85"><Plus className="size-3.5" />添加预约</button></div></div>
      {showCreate && <form onSubmit={createReservation} className="mt-5 rounded-xl border border-border/70 bg-background/60 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-foreground">预约明细</p><p className="mt-1 text-xs text-muted-foreground">每一行是一条预约，可添加不同日期和时间。</p></div><button type="button" onClick={() => setCreateForm((current) => ({ ...current, selections: [...current.selections, { id: Math.max(...current.selections.map((selection) => selection.id), 0) + 1, studioId: settings?.studios.find((studio) => studio.enabled)?.id || '', date: addDays(startOfToday(), 1), startMinutes: 600, endMinutes: 660 }] }))} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground hover:bg-accent"><Plus className="size-3.5" />添加一条</button></div><div className="mt-4 space-y-2">{createForm.selections.map((selection, index) => <div key={selection.id} className="grid gap-2 rounded-lg border border-border/70 bg-background p-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_2.25rem] sm:items-end"><label className="text-xs text-muted-foreground">棚子<select required value={selection.studioId} onChange={(event) => setCreateForm((current) => ({ ...current, selections: current.selections.map((item) => item.id === selection.id ? { ...item, studioId: event.target.value } : item) }))} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground">{settings?.studios.filter((studio) => studio.enabled).map((studio) => <option key={studio.id} value={studio.id}>{studio.name}</option>)}</select></label><label className="text-xs text-muted-foreground">日期<input required type="date" value={selection.date} onChange={(event) => setCreateForm((current) => ({ ...current, selections: current.selections.map((item) => item.id === selection.id ? { ...item, date: event.target.value } : item) }))} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground" /></label><label className="text-xs text-muted-foreground">开始时间<select value={selection.startMinutes} onChange={(event) => setCreateForm((current) => ({ ...current, selections: current.selections.map((item) => item.id === selection.id ? { ...item, startMinutes: Number(event.target.value), endMinutes: Math.max(item.endMinutes, Number(event.target.value) + 60) } : item) }))} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground">{TIME_OPTIONS.filter((option) => option.minutes <= 20 * 60).map((option) => <option key={option.minutes} value={option.minutes}>{option.label}</option>)}</select></label><label className="text-xs text-muted-foreground">结束时间<select value={selection.endMinutes} onChange={(event) => setCreateForm((current) => ({ ...current, selections: current.selections.map((item) => item.id === selection.id ? { ...item, endMinutes: Number(event.target.value) } : item) }))} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground">{TIME_OPTIONS.filter((option) => option.minutes >= selection.startMinutes + 60).map((option) => <option key={option.minutes} value={option.minutes}>{option.label}</option>)}</select></label><button type="button" aria-label={`删除第 ${index + 1} 条预约`} disabled={createForm.selections.length === 1} onClick={() => setCreateForm((current) => ({ ...current, selections: current.selections.filter((item) => item.id !== selection.id) }))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"><X className="size-4" /></button></div>)}</div><div className="mt-4 flex flex-wrap gap-2">{CONTACT_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setCreateForm((current) => ({ ...current, contactType: option.value }))} className={`rounded-lg border px-3 py-1.5 text-xs ${createForm.contactType === option.value ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-accent'}`}>{option.label}</button>)}</div><div className="mt-3 grid gap-3 sm:grid-cols-2"><input required value={createForm.contactValue} onChange={(event) => setCreateForm((current) => ({ ...current, contactValue: event.target.value }))} placeholder="联系方式" className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none" /><input required value={createForm.customerName} onChange={(event) => setCreateForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="称呼（CN）" className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none" /></div><textarea value={createForm.note} onChange={(event) => setCreateForm((current) => ({ ...current, note: event.target.value }))} rows={2} placeholder="备注（可选）" className="mt-3 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none" /><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="h-9 rounded-xl border border-border px-3 text-xs text-muted-foreground hover:bg-accent">取消</button><button type="submit" disabled={creating} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50">{creating && <Loader2 className="size-3.5 animate-spin" />}保存预约</button></div></form>}
      {loading ? <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />正在加载预约</div> : visibleBookings.length === 0 ? <div className="rounded-xl border border-dashed border-border/80 px-4 py-12 text-center text-sm text-muted-foreground">当前没有预约记录。</div> : <div className="mt-5 space-y-3">{visibleBookings.map((booking) => <BookingRow key={booking.id} booking={booking} working={workingId === booking.id} deleting={deletingId === booking.id} onUpdate={updateStatus} onDelete={deleteReservation} />)}</div>}</section>
  </div>
}

function ScheduleRow({ schedule, label, onChange }: { schedule: Schedule; label: string; onChange: (patch: Partial<Schedule>) => void }) {
  return <div className={`grid gap-3 rounded-2xl border p-3 sm:grid-cols-[5rem_17rem_17rem] sm:items-center sm:justify-start ${schedule.enabled ? 'border-border/70 bg-background/60' : 'border-border/40 bg-muted/30'}`}><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={schedule.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} className="size-4 accent-foreground" />{label}</label><TimeSelect label="开始营业" value={schedule.openMinutes} disabled={!schedule.enabled} onChange={(value) => onChange({ openMinutes: value })} /><TimeSelect label="结束营业" value={schedule.closeMinutes} disabled={!schedule.enabled} onChange={(value) => onChange({ closeMinutes: value })} /></div>
}

function TimeSelect({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label className="flex items-center justify-start gap-3 text-xs text-muted-foreground"><span className="shrink-0">{label}</span><span className="relative"><select value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="h-9 w-28 appearance-none rounded-lg border border-border bg-background px-3 pr-8 text-sm text-foreground outline-none disabled:opacity-40">{TIME_OPTIONS.map((option) => <option key={option.minutes} value={option.minutes}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /></span></label>
}

function BookingRow({ booking, working, deleting, onUpdate, onDelete }: { booking: Booking; working: boolean; deleting: boolean; onUpdate: (id: string, status: 'confirmed' | 'rejected') => void; onDelete: (id: string) => void }) {
  const contactLabel = booking.contactType === 'phone' ? '手机号' : booking.contactType === 'wechat' ? '微信号' : '其他联系方式'
  return <article className="rounded-2xl border border-border/70 bg-background/60 p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-foreground">{booking.date} · {booking.start}–{booking.end}</p><span className="rounded-md bg-muted px-2 py-1 text-[0.68rem] text-foreground">{booking.studioName || '未命名棚子'}</span><span className={`rounded-full px-2 py-1 text-[0.68rem] ${booking.status === 'pending' ? 'bg-accent text-accent-foreground' : booking.status === 'confirmed' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{statusLabel(booking.status)}</span></div><p className="mt-2 text-sm text-foreground">CN：{booking.customerName || '未填写'}</p><p className="mt-1 text-xs text-muted-foreground">{contactLabel}：{booking.contactValue}</p>{booking.note && <p className="mt-2 rounded-xl bg-muted/45 px-3 py-2 text-xs leading-5 text-muted-foreground">备注：{booking.note}</p>}</div><div className="flex shrink-0 gap-2"><button type="button" disabled={working || deleting} onClick={() => onDelete(booking.id)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"><Trash2 className="size-3.5" />{deleting ? '删除中' : '删除'}</button>{booking.status === 'pending' && <><button type="button" disabled={working || deleting} onClick={() => onUpdate(booking.id, 'rejected')} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"><X className="size-3.5" />拒绝</button><button type="button" disabled={working || deleting} onClick={() => onUpdate(booking.id, 'confirmed')} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 text-xs text-background hover:opacity-85 disabled:opacity-50">{working ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}确认预约</button></>}</div></div></article>
}
