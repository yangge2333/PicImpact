'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { ReloadIcon } from '@radix-ui/react-icons'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { MarkdownContent } from '~/components/markdown/markdown-content'
import { fetcher } from '~/lib/utils/fetcher'
import type { AboutInfo } from '~/types'

export default function AboutSettingsPage() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const { data, isValidating, isLoading, mutate } = useSWR<AboutInfo>('/api/v1/settings/about-info', fetcher)

  useEffect(() => {
    if (!data) return
    setContent(data.aboutMeMarkdown ?? '')
  }, [data])

  async function updateInfo() {
    try {
      setLoading(true)
      await fetch('/api/v1/settings/about-info', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ aboutMeMarkdown: content }),
      }).then((res) => {
        if (!res.ok) throw new Error('Request failed')
        return res.json()
      })
      await mutate()
      toast.success('保存成功')
    } catch {
      toast.error('保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">关于我</h1>
          <p className="mt-1 text-sm text-muted-foreground">编辑前台 /about 页面展示的 Markdown 内容。</p>
        </div>
        <Button
          variant="outline"
          disabled={loading || isValidating}
          onClick={() => updateInfo()}
          aria-label="保存关于我"
          className="cursor-pointer"
        >
          {loading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
          保存
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <div className="flex min-h-[28rem] flex-col gap-2">
          <Label htmlFor="aboutMeMarkdown">Markdown</Label>
          <Textarea
            id="aboutMeMarkdown"
            disabled={isValidating || isLoading}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-[28rem] flex-1 resize-none text-sm leading-6"
            placeholder="# 关于我"
          />
        </div>

        <div className="min-h-[28rem] overflow-auto rounded-md border border-border/70 bg-background/70 p-5">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Preview</p>
          <MarkdownContent content={content} />
        </div>
      </div>
    </div>
  )
}
