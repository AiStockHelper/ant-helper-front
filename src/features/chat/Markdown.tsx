import { Children, isValidElement, memo, useState, type ReactElement, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/cn'

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const child = Children.toArray(children)[0]
  let text = ''
  let lang = ''
  if (isValidElement(child)) {
    const el = child as ReactElement<{ className?: string; children?: ReactNode }>
    text = String(el.props.children ?? '').replace(/\n$/, '')
    lang = /language-(\S+)/.exec(el.props.className ?? '')?.[1] ?? ''
  }
  const onCopy = async () => {
    if (await copyText(text)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-surface-2">
      <div className="flex items-center justify-between border-b border-border px-3 py-1 text-xs text-subtle">
        <span>{lang || 'text'}</span>
        <button
          type="button"
          onClick={onCopy}
          className="-mr-2 inline-flex h-9 items-center gap-1 rounded-md px-2 hover:text-fg md:h-7"
          aria-label="코드 복사"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  )
}

const components: Components = {
  a: ({ href, children }) =>
    href?.startsWith('/') ? (
      <Link to={href}>{children}</Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
}

const plugins = [remarkGfm]

export const Markdown = memo(function Markdown({ text, streaming, className }: { text: string; streaming?: boolean; className?: string }) {
  return (
    <div className={cn('md', streaming && 'md-streaming', className)}>
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
})
