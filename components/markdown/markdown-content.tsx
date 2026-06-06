import type { ReactNode } from 'react'

type InlineToken = {
  type: 'text' | 'strong' | 'em' | 'code' | 'link'
  text: string
  href?: string
}

const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g

function isSafeHref(href: string) {
  return href.startsWith('/') || href.startsWith('https://') || href.startsWith('http://') || href.startsWith('mailto:') || href.startsWith('tel:')
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let lastIndex = 0

  for (const match of text.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push({ type: 'text', text: text.slice(lastIndex, index) })
    }

    if (match[1] && match[2]) {
      tokens.push({
        type: 'link',
        text: match[1],
        href: isSafeHref(match[2]) ? match[2] : '#',
      })
    } else if (match[3]) {
      tokens.push({ type: 'code', text: match[3] })
    } else if (match[4]) {
      tokens.push({ type: 'strong', text: match[4] })
    } else if (match[5]) {
      tokens.push({ type: 'em', text: match[5] })
    }

    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return tokens
}

function renderInline(text: string) {
  return parseInline(text).map((token, index) => {
    const key = `${token.type}-${index}`
    if (token.type === 'strong') return <strong key={key}>{token.text}</strong>
    if (token.type === 'em') return <em key={key}>{token.text}</em>
    if (token.type === 'code') {
      return (
        <code key={key} className="rounded bg-foreground/8 px-1.5 py-0.5 text-[0.92em]">
          {token.text}
        </code>
      )
    }
    if (token.type === 'link') {
      return (
        <a key={key} href={token.href} className="underline underline-offset-4 hover:text-foreground">
          {token.text}
        </a>
      )
    }
    return <span key={key}>{token.text}</span>
  })
}

function flushParagraph(blocks: ReactNode[], lines: string[], keyPrefix: string) {
  if (lines.length === 0) return
  blocks.push(
    <p key={`${keyPrefix}-${blocks.length}`}>
      {renderInline(lines.join(' '))}
    </p>
  )
  lines.length = 0
}

export function MarkdownContent({ content }: { content: string }) {
  const blocks: ReactNode[] = []
  const paragraphLines: string[] = []
  const lines = content.replace(/\r\n/g, '\n').split('\n')

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex].trim()

    if (!line) {
      flushParagraph(blocks, paragraphLines, 'p')
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      flushParagraph(blocks, paragraphLines, 'p')
      const level = heading[1].length
      const children = renderInline(heading[2])
      if (level === 1) blocks.push(<h1 key={`h1-${blocks.length}`}>{children}</h1>)
      else if (level === 2) blocks.push(<h2 key={`h2-${blocks.length}`}>{children}</h2>)
      else blocks.push(<h3 key={`h3-${blocks.length}`}>{children}</h3>)
      continue
    }

    if (/^---+$/.test(line)) {
      flushParagraph(blocks, paragraphLines, 'p')
      blocks.push(<hr key={`hr-${blocks.length}`} />)
      continue
    }

    const quote = /^>\s?(.+)$/.exec(line)
    if (quote) {
      flushParagraph(blocks, paragraphLines, 'p')
      blocks.push(<blockquote key={`quote-${blocks.length}`}>{renderInline(quote[1])}</blockquote>)
      continue
    }

    const unordered = /^[-*]\s+(.+)$/.exec(line)
    if (unordered) {
      flushParagraph(blocks, paragraphLines, 'p')
      const items = [unordered[1]]
      while (lineIndex + 1 < lines.length) {
        const next = /^[-*]\s+(.+)$/.exec(lines[lineIndex + 1].trim())
        if (!next) break
        items.push(next[1])
        lineIndex += 1
      }
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
        </ul>
      )
      continue
    }

    paragraphLines.push(line)
  }

  flushParagraph(blocks, paragraphLines, 'p')

  return (
    <div className="space-y-5 text-sm leading-7 text-foreground/78 [&_a]:text-foreground [&_blockquote]:border-l-2 [&_blockquote]:border-foreground/20 [&_blockquote]:pl-4 [&_blockquote]:text-foreground/64 [&_h1]:font-hero-title [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h2]:pt-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:pt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_hr]:border-foreground/12 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      {blocks}
    </div>
  )
}
