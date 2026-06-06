import { MarkdownContent } from '~/components/markdown/markdown-content'
import { cachedConfigsByKeys } from '~/server/lib/cache'
import { toAboutInfo, toCustomInfo } from '~/server/lib/config-transform'

export default async function AboutPage() {
  const [aboutRows, titleRows] = await Promise.all([
    cachedConfigsByKeys(['about_me_markdown']),
    cachedConfigsByKeys(['custom_title']),
  ])
  const about = toAboutInfo(aboutRows)
  const title = toCustomInfo(titleRows).customTitle || '船长的摄影小屋'

  return (
    <div className="min-h-[calc(100svh-2.5rem)] bg-background">
      <section className="mx-auto flex w-full max-w-3xl flex-col px-5 py-12 sm:px-8 sm:py-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          About
        </p>
        <h1 className="font-hero-title text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
          关于我
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {title}
        </p>
        <article className="mt-10 border-t border-border/70 pt-8">
          <MarkdownContent content={about.aboutMeMarkdown} />
        </article>
      </section>
    </div>
  )
}
