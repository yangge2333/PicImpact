'use client'

import { useEffect, useState } from 'react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CameraIcon,
  ImagePlusIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  TagsIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { STORAGE_OPTIONS, useUploadConfig } from '~/hooks/use-upload-config'

type EquipmentStatus = 'available' | 'in_use' | 'maintenance' | 'retired';

interface EquipmentCategory {
  id: string;
  name: string;
  sort: number;
  assetCount: number;
}

interface EquipmentAsset {
  id: string;
  assetNumber: string;
  name: string;
  categoryId: string;
  category: Pick<EquipmentCategory, 'id' | 'name'>;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  status: EquipmentStatus;
  purchaseDate: string | null;
  purchasePrice: number | null;
  storageLocation: string | null;
  custodian: string | null;
  notes: string | null;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
}

interface AssetListResult {
  items: EquipmentAsset[];
  total: number;
  page: number;
  pageSize: number;
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface AssetForm {
  assetNumber: string;
  name: string;
  categoryId: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: EquipmentStatus;
  purchaseDate: string;
  purchasePrice: string;
  storageLocation: string;
  custodian: string;
  notes: string;
  imageUrls: string[];
}

const PAGE_SIZE = 10
const MAX_IMAGES = 6

const STATUS_OPTIONS: Array<{ value: EquipmentStatus; label: string }> = [
  { value: 'available', label: '可用' },
  { value: 'in_use', label: '使用中' },
  { value: 'maintenance', label: '维修中' },
  { value: 'retired', label: '已报废' },
]

const EMPTY_FORM: AssetForm = {
  assetNumber: '',
  name: '',
  categoryId: '',
  brand: '',
  model: '',
  serialNumber: '',
  status: 'available',
  purchaseDate: '',
  purchasePrice: '',
  storageLocation: '',
  custodian: '',
  notes: '',
  imageUrls: [],
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const payload = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || payload.code !== 200) {
    throw new Error(payload.message || '请求失败')
  }
  return payload.data
}

function statusLabel(status: EquipmentStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status
}

function nullable(value: string) {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export default function EquipmentAssetsPage() {
  const [categories, setCategories] = useState<EquipmentCategory[]>([])
  const [assets, setAssets] = useState<EquipmentAsset[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [assetDialogOpen, setAssetDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  const [form, setForm] = useState<AssetForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  )
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const {
    storage,
    storageSelect,
    openListStorage,
    openListMountPath,
    setOpenListMountPath,
    handleStorageChange,
    uploadWithHeicConversion,
  } = useUploadConfig()

  async function loadCategories() {
    const result = await request<EquipmentCategory[]>(
      '/api/v1/equipment-assets/categories',
    )
    setCategories(result)
  }

  async function loadAssets(targetPage = page) {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      })
      if (keyword.trim()) params.set('keyword', keyword.trim())
      if (categoryFilter) params.set('categoryId', categoryFilter)
      if (statusFilter) params.set('status', statusFilter)
      const result = await request<AssetListResult>(
        `/api/v1/equipment-assets?${params}`,
      )
      setAssets(result.items)
      setTotal(result.total)
      setPage(result.page)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载器材失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.all([loadCategories(), loadAssets(1)]).catch(
      (error: unknown) => {
        toast.error(error instanceof Error ? error.message : '加载数据失败')
        setLoading(false)
      },
    )
    // 页面首次加载时读取数据，筛选由查询按钮显式触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreateDialog() {
    setEditingAssetId(null)
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? '' })
    setAssetDialogOpen(true)
  }

  function openEditDialog(asset: EquipmentAsset) {
    setEditingAssetId(asset.id)
    setForm({
      assetNumber: asset.assetNumber,
      name: asset.name,
      categoryId: asset.categoryId,
      brand: asset.brand ?? '',
      model: asset.model ?? '',
      serialNumber: asset.serialNumber ?? '',
      status: asset.status,
      purchaseDate: asset.purchaseDate?.slice(0, 10) ?? '',
      purchasePrice:
        asset.purchasePrice === null ? '' : String(asset.purchasePrice),
      storageLocation: asset.storageLocation ?? '',
      custodian: asset.custodian ?? '',
      notes: asset.notes ?? '',
      imageUrls: asset.imageUrls,
    })
    setAssetDialogOpen(true)
  }

  function updateForm<K extends keyof AssetForm>(key: K, value: AssetForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submitAsset() {
    if (!form.assetNumber.trim() || !form.name.trim() || !form.categoryId) {
      toast.error('请填写资产编号、器材名称和分类')
      return
    }
    const price =
      form.purchasePrice.trim() === '' ? null : Number(form.purchasePrice)
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      toast.error('采购价格必须是非负数')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        assetNumber: form.assetNumber.trim(),
        name: form.name.trim(),
        categoryId: form.categoryId,
        brand: nullable(form.brand),
        model: nullable(form.model),
        serialNumber: nullable(form.serialNumber),
        status: form.status,
        purchaseDate: form.purchaseDate || null,
        purchasePrice: price,
        storageLocation: nullable(form.storageLocation),
        custodian: nullable(form.custodian),
        notes: nullable(form.notes),
        imageUrls: form.imageUrls,
      }
      await request<EquipmentAsset>(
        editingAssetId
          ? `/api/v1/equipment-assets/${editingAssetId}`
          : '/api/v1/equipment-assets',
        {
          method: editingAssetId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      )
      toast.success(editingAssetId ? '器材信息已更新' : '器材已登记')
      setAssetDialogOpen(false)
      await Promise.all([
        loadCategories(),
        loadAssets(editingAssetId ? page : 1),
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteAsset(asset: EquipmentAsset) {
    if (!window.confirm(`确认删除器材“${asset.name}”吗？`)) return
    try {
      await request<null>(`/api/v1/equipment-assets/${asset.id}`, {
        method: 'DELETE',
      })
      toast.success('器材已删除')
      await Promise.all([
        loadCategories(),
        loadAssets(assets.length === 1 && page > 1 ? page - 1 : page),
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  async function moveAsset(asset: EquipmentAsset, direction: 'up' | 'down') {
    try {
      const result = await request<{ moved: boolean }>(
        `/api/v1/equipment-assets/${asset.id}/order`,
        {
          method: 'PATCH',
          body: JSON.stringify({ direction }),
        },
      )
      if (result.moved) {
        toast.success('排序已更新')
        await loadAssets(page)
      } else {
        toast.info(direction === 'up' ? '已经是第一项' : '已经是最后一项')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '调整排序失败')
    }
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return
    const remaining = MAX_IMAGES - form.imageUrls.length
    if (remaining <= 0) {
      toast.error(`最多上传 ${MAX_IMAGES} 张图片`)
      return
    }
    const selected = Array.from(files).slice(0, remaining)
    if (
      selected.some(
        (file) =>
          !file.type.startsWith('image/') && !/\.hei[cf]$/i.test(file.name),
      )
    ) {
      toast.error('请选择图片文件')
      return
    }
    if (selected.some((file) => file.size > 20 * 1024 * 1024)) {
      toast.error('单张图片不能超过 20MB')
      return
    }
    if (storage === 'openList' && !openListMountPath) {
      toast.error('请先选择 OpenList 存储目录')
      return
    }

    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of selected) {
        const { res } = await uploadWithHeicConversion(
          file,
          '/equipment-assets',
        )
        if (!res.data?.url) throw new Error('上传结果缺少图片地址')
        urls.push(res.data.url)
      }
      setForm((current) => ({
        ...current,
        imageUrls: [...current.imageUrls, ...urls],
      }))
      toast.success(`已上传 ${urls.length} 张图片`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '图片上传失败')
    } finally {
      setUploading(false)
    }
  }

  async function createCategory() {
    if (!categoryName.trim()) return
    try {
      await request<EquipmentCategory>('/api/v1/equipment-assets/categories', {
        method: 'POST',
        body: JSON.stringify({ name: categoryName.trim() }),
      })
      setCategoryName('')
      await loadCategories()
      toast.success('分类已创建')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建分类失败')
    }
  }

  async function updateCategory(category: EquipmentCategory) {
    if (!editingCategoryName.trim()) return
    try {
      await request<EquipmentCategory>(
        `/api/v1/equipment-assets/categories/${category.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name: editingCategoryName.trim() }),
        },
      )
      setEditingCategoryId(null)
      await Promise.all([loadCategories(), loadAssets(page)])
      toast.success('分类已更新')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新分类失败')
    }
  }

  async function deleteCategory(category: EquipmentCategory) {
    if (category.assetCount > 0) {
      toast.error('该分类下仍有器材，不能删除')
      return
    }
    if (!window.confirm(`确认删除分类“${category.name}”吗？`)) return
    try {
      await request<null>(
        `/api/v1/equipment-assets/categories/${category.id}`,
        { method: 'DELETE' },
      )
      await loadCategories()
      toast.success('分类已删除')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除分类失败')
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CameraIcon className="size-6" />
            <h1 className="text-2xl font-semibold">摄影器材资产</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            登记、分类并追踪摄影器材的使用状态和保管信息。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>
            <TagsIcon className="size-4" />
            分类管理
          </Button>
          <Button onClick={openCreateDialog} disabled={categories.length === 0}>
            <PlusIcon className="size-4" />
            登记器材
          </Button>
        </div>
      </div>

      {categories.length === 0 && !loading && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          暂无器材分类，请先在“分类管理”中创建分类。
        </div>
      )}

      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[minmax(220px,1fr)_180px_160px_auto]">
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void loadAssets(1)}
          placeholder="搜索编号、名称、品牌、型号或序列号"
        />
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="">全部分类</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button onClick={() => void loadAssets(1)}>
          <RefreshCwIcon className="size-4" />
          查询
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">图片</th>
                <th className="px-4 py-3 font-medium">资产编号</th>
                <th className="px-4 py-3 font-medium">器材 / 分类</th>
                <th className="px-4 py-3 font-medium">品牌 / 型号</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">存放位置</th>
                <th className="px-4 py-3 font-medium">保管人</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="h-40 text-center text-muted-foreground"
                  >
                    <Loader2Icon className="mx-auto size-5 animate-spin" />
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="h-40 text-center text-muted-foreground"
                  >
                    暂无符合条件的器材
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      {asset.imageUrls[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.imageUrls[0]}
                          alt={asset.name}
                          className="size-14 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="flex size-14 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                          <CameraIcon className="size-5" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {asset.assetNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{asset.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {asset.category.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{asset.brand || '-'}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {asset.model || asset.serialNumber || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                        {statusLabel(asset.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {asset.storageLocation || '-'}
                    </td>
                    <td className="px-4 py-3">{asset.custodian || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="上移"
                          onClick={() => void moveAsset(asset, 'up')}
                        >
                          <ArrowUpIcon className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="下移"
                          onClick={() => void moveAsset(asset, 'down')}
                        >
                          <ArrowDownIcon className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="编辑"
                          onClick={() => openEditDialog(asset)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="删除"
                          onClick={() => void deleteAsset(asset)}
                        >
                          <Trash2Icon className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            共 {total} 件器材，第 {page} / {pageCount} 页
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => void loadAssets(page - 1)}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount || loading}
              onClick={() => void loadAssets(page + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAssetId ? '编辑器材资产' : '登记器材资产'}
            </DialogTitle>
            <DialogDescription>
              带 * 的字段为必填项，图片最多上传 {MAX_IMAGES} 张。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>资产编号 *</Label>
              <Input
                value={form.assetNumber}
                onChange={(event) =>
                  updateForm('assetNumber', event.target.value)
                }
                placeholder="例如 CAM-2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label>器材名称 *</Label>
              <Input
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                placeholder="例如 Sony A7R V"
              />
            </div>
            <div className="space-y-2">
              <Label>分类 *</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={form.categoryId}
                onChange={(event) =>
                  updateForm('categoryId', event.target.value)
                }
              >
                <option value="">请选择分类</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>使用状态</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={form.status}
                onChange={(event) =>
                  updateForm('status', event.target.value as EquipmentStatus)
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>品牌</Label>
              <Input
                value={form.brand}
                onChange={(event) => updateForm('brand', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>型号</Label>
              <Input
                value={form.model}
                onChange={(event) => updateForm('model', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>序列号</Label>
              <Input
                value={form.serialNumber}
                onChange={(event) =>
                  updateForm('serialNumber', event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>保管人</Label>
              <Input
                value={form.custodian}
                onChange={(event) =>
                  updateForm('custodian', event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>采购日期</Label>
              <Input
                type="date"
                value={form.purchaseDate}
                onChange={(event) =>
                  updateForm('purchaseDate', event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>采购价格</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={(event) =>
                  updateForm('purchasePrice', event.target.value)
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>存放位置</Label>
              <Input
                value={form.storageLocation}
                onChange={(event) =>
                  updateForm('storageLocation', event.target.value)
                }
                placeholder="例如 1 号器材柜 A 层"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>备注</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(event) => updateForm('notes', event.target.value)}
              />
            </div>
            <div className="space-y-3 md:col-span-2">
              <Label>器材图片</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={storage}
                  onChange={(event) =>
                    void handleStorageChange(event.target.value)
                  }
                >
                  {STORAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {storageSelect && (
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={openListMountPath}
                    onChange={(event) =>
                      setOpenListMountPath(event.target.value)
                    }
                  >
                    <option value="">请选择 OpenList 目录</option>
                    {openListStorage.map((item) => (
                      <option key={item.mount_path} value={item.mount_path}>
                        {item.mount_path}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {form.imageUrls.map((url, index) => (
                  <div key={`${url}-${index}`} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`器材图片 ${index + 1}`}
                      className="size-24 rounded-md border object-cover"
                    />
                    <button
                      type="button"
                      className="absolute -right-2 -top-2 rounded-full border bg-background p-1 shadow"
                      onClick={() =>
                        updateForm(
                          'imageUrls',
                          form.imageUrls.filter(
                            (_, imageIndex) => imageIndex !== index,
                          ),
                        )
                      }
                    >
                      <XIcon className="size-3" />
                      <span className="sr-only">移除图片</span>
                    </button>
                  </div>
                ))}
                {form.imageUrls.length < MAX_IMAGES && (
                  <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted/50">
                    {uploading ? (
                      <Loader2Icon className="size-5 animate-spin" />
                    ) : (
                      <ImagePlusIcon className="size-5" />
                    )}
                    {uploading ? '上传中' : '上传图片'}
                    <input
                      type="file"
                      accept="image/*,.heic,.heif"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={(event) => {
                        void uploadImages(event.target.files)
                        event.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetDialogOpen(false)}>
              取消
            </Button>
            <Button
              disabled={submitting || uploading}
              onClick={() => void submitAsset()}
            >
              {submitting && <Loader2Icon className="size-4 animate-spin" />}
              {editingAssetId ? '保存修改' : '确认登记'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>器材分类管理</DialogTitle>
            <DialogDescription>
              分类名称可自定义；已有器材的分类不能删除。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              onKeyDown={(event) =>
                event.key === 'Enter' && void createCategory()
              }
              placeholder="输入新分类名称"
            />
            <Button
              onClick={() => void createCategory()}
              disabled={!categoryName.trim()}
            >
              <PlusIcon className="size-4" />
              添加
            </Button>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {categories.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无分类
              </div>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-2 rounded-md border p-3"
                >
                  {editingCategoryId === category.id ? (
                    <Input
                      className="h-8"
                      value={editingCategoryName}
                      autoFocus
                      onChange={(event) =>
                        setEditingCategoryName(event.target.value)
                      }
                      onKeyDown={(event) =>
                        event.key === 'Enter' && void updateCategory(category)
                      }
                    />
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {category.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {category.assetCount} 件器材
                      </div>
                    </div>
                  )}
                  {editingCategoryId === category.id ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => void updateCategory(category)}
                      >
                        保存
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingCategoryId(null)}
                      >
                        取消
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingCategoryId(category.id)
                          setEditingCategoryName(category.name)
                        }}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={category.assetCount > 0}
                        onClick={() => void deleteCategory(category)}
                      >
                        <Trash2Icon className="size-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
