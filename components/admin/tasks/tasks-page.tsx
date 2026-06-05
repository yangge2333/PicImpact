'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { fetcher } from '~/lib/utils/fetcher'
import type { AlbumType } from '~/types'
import type { AdminTaskScope } from '~/types/admin-tasks'
import { ADMIN_TASK_KEY_REFRESH_IMAGE_METADATA } from '~/types/admin-tasks'
import TaskRunPanel, { type ScopeControlProps, type TaskRunPanelConfig } from '~/components/admin/tasks/task-run-panel'

type AlbumOption = Pick<AlbumType, 'id' | 'name' | 'album_value'>

const METADATA_DEFAULT_SCOPE: AdminTaskScope = { albumValue: 'all', showStatus: -1 }

function MetadataScopeControl({ scope, setScope, disabled }: ScopeControlProps<AdminTaskScope>) {
  const tx = useTranslations()
  const { data: albums } = useSWR<AlbumOption[]>('/api/v1/albums', fetcher)

  return (
    <div className='flex w-fit flex-wrap items-end gap-3'>
      <label className='flex w-[8.75rem] shrink-0 flex-col gap-1.5'>
        <span className='text-sm font-medium text-foreground'>{tx('Words.album')}</span>
        <Select value={scope.albumValue} onValueChange={(albumValue) => setScope((current) => ({ ...current, albumValue }))} disabled={disabled}>
          <SelectTrigger className='h-10 w-full rounded-[0.95rem] bg-background/75'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{tx('Words.all')}</SelectItem>
            {albums?.map((album) => (
              <SelectItem key={album.id} value={album.album_value}>{album.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className='flex w-[8.75rem] shrink-0 flex-col gap-1.5'>
        <span className='text-sm font-medium text-foreground'>{tx('Words.showStatus')}</span>
        <Select
          value={String(scope.showStatus)}
          onValueChange={(value) => setScope((current) => ({
            ...current,
            showStatus: value === '0' ? 0 : value === '1' ? 1 : -1,
          }))}
          disabled={disabled}
        >
          <SelectTrigger className='h-10 w-full rounded-[0.95rem] bg-background/75'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='-1'>{tx('Words.all')}</SelectItem>
            <SelectItem value='0'>{tx('Words.public')}</SelectItem>
            <SelectItem value='1'>{tx('Words.private')}</SelectItem>
          </SelectContent>
        </Select>
      </label>
    </div>
  )
}

export default function TasksPage() {
  const t = useTranslations('Tasks')
  const tx = useTranslations()

  const albumName = useMemo(() => {
    return (albumValue: string, albums: AlbumOption[] | undefined) =>
      albumValue === 'all' ? tx('Words.all') : albums?.find((album) => album.album_value === albumValue)?.name || albumValue
  }, [tx])

  const showLabel = useMemo(() => {
    return (showStatus: AdminTaskScope['showStatus']) =>
      showStatus === 0 ? tx('Words.public') : showStatus === 1 ? tx('Words.private') : tx('Words.all')
  }, [tx])

  const { data: metadataAlbums } = useSWR<AlbumOption[]>('/api/v1/albums', fetcher)
  const albumsLoading = !metadataAlbums

  const metadataConfig = useMemo<TaskRunPanelConfig<AdminTaskScope>>(() => ({
    basePath: '/api/v1/tasks',
    taskKey: ADMIN_TASK_KEY_REFRESH_IMAGE_METADATA,
    defaultScope: METADATA_DEFAULT_SCOPE,
    previewCountQuery: (scope) =>
      new URLSearchParams({ albumValue: scope.albumValue, showStatus: String(scope.showStatus) }).toString(),
    scopeLabel: (scope) => `${albumName(scope.albumValue, metadataAlbums)} / ${showLabel(scope.showStatus)}`,
    ScopeControl: MetadataScopeControl,
    renderExtraHints: () => (albumsLoading ? <p>{t('albumsLoading')}</p> : null),
    extraBooting: albumsLoading,
  }), [albumName, showLabel, metadataAlbums, albumsLoading, t])

  return <TaskRunPanel config={metadataConfig} />
}
