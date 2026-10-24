import { describe, expect, it } from 'vitest'
import { createSseParser, readSseStream, type SseMessage } from './sse'

function parseAll(chunks: string[]): SseMessage[] {
  const out: SseMessage[] = []
  const p = createSseParser((m) => out.push(m))
  chunks.forEach((c) => p.feed(c))
  p.flush()
  return out
}

const sample =
  'event: meta\ndata: {"a":1}\n\n' +
  'event: delta\ndata: {"text":"안녕"}\n\n' +
  'event: done\ndata: {"ok":true}\n\n'

const expected: SseMessage[] = [
  { event: 'meta', data: '{"a":1}' },
  { event: 'delta', data: '{"text":"안녕"}' },
  { event: 'done', data: '{"ok":true}' },
]

describe('createSseParser', () => {
  it('parses complete blocks', () => {
    expect(parseAll([sample])).toEqual(expected)
  })

  it('handles every possible chunk split (LF)', () => {
    for (let i = 0; i <= sample.length; i++) {
      expect(parseAll([sample.slice(0, i), sample.slice(i)])).toEqual(expected)
    }
  })

  it('handles CRLF, including a split between \\r and \\n', () => {
    const crlf = sample.replace(/\n/g, '\r\n')
    expect(parseAll([crlf])).toEqual(expected)
    for (let i = 0; i <= crlf.length; i++) {
      expect(parseAll([crlf.slice(0, i), crlf.slice(i)])).toEqual(expected)
    }
  })

  it('handles one char at a time', () => {
    expect(parseAll(sample.split(''))).toEqual(expected)
    const crlf = sample.replace(/\n/g, '\r\n')
    expect(parseAll(crlf.split(''))).toEqual(expected)
  })

  it('supports bare CR line endings', () => {
    expect(parseAll(['event: x\rdata: 1\r\r'])).toEqual([{ event: 'x', data: '1' }])
  })

  it('joins multi-line data with newline', () => {
    expect(parseAll(['event: x\ndata: a\ndata: b\n\n'])).toEqual([{ event: 'x', data: 'a\nb' }])
  })

  it('ignores comments and heartbeat, defaults event name to message', () => {
    expect(parseAll([': ping\n\ndata: hi\n\n'])).toEqual([{ event: 'message', data: 'hi' }])
  })

  it('accepts fields without a space after the colon', () => {
    expect(parseAll(['event:x\ndata:{"a":1}\n\n'])).toEqual([{ event: 'x', data: '{"a":1}' }])
  })

  it('does not emit an event that has no data', () => {
    expect(parseAll(['event: x\n\n'])).toEqual([])
  })

  it('flush emits a trailing block without final blank line', () => {
    expect(parseAll(['event: done\ndata: {}'])).toEqual([{ event: 'done', data: '{}' }])
  })
})

describe('readSseStream', () => {
  it('decodes multibyte characters split across byte chunks', async () => {
    const bytes = new TextEncoder().encode(sample)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3))
        controller.close()
      },
    })
    const out: SseMessage[] = []
    await readSseStream(stream, (m) => out.push(m))
    expect(out).toEqual(expected)
  })
})
