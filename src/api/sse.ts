export interface SseMessage {
  event: string
  data: string
}

export interface SseParser {
  feed(chunk: string): void
  flush(): void
}

/**
 * text/event-stream 파서. 청크 경계에서 잘린 줄/블록, \r\n · \r · \n 줄바꿈,
 * 여러 줄 data, 주석(:) 을 처리한다.
 */
export function createSseParser(onMessage: (msg: SseMessage) => void): SseParser {
  let buffer = ''
  let eventName = ''
  let dataLines: string[] = []
  let skipLF = false

  const dispatch = () => {
    if (dataLines.length > 0) {
      onMessage({ event: eventName || 'message', data: dataLines.join('\n') })
    }
    eventName = ''
    dataLines = []
  }

  const processLine = (line: string) => {
    if (line === '') {
      dispatch()
      return
    }
    if (line.startsWith(':')) return
    const idx = line.indexOf(':')
    const field = idx === -1 ? line : line.slice(0, idx)
    let value = idx === -1 ? '' : line.slice(idx + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') eventName = value
    else if (field === 'data') dataLines.push(value)
  }

  return {
    feed(chunk: string) {
      let text = chunk
      if (skipLF) {
        if (text.startsWith('\n')) text = text.slice(1)
        skipLF = false
      }
      buffer += text
      let start = 0
      for (let i = 0; i < buffer.length; i++) {
        const c = buffer[i]
        if (c !== '\n' && c !== '\r') continue
        processLine(buffer.slice(start, i))
        if (c === '\r') {
          if (buffer[i + 1] === '\n') i++
          else if (i + 1 === buffer.length) skipLF = true
        }
        start = i + 1
      }
      buffer = buffer.slice(start)
    },
    flush() {
      if (buffer) {
        processLine(buffer)
        buffer = ''
      }
      dispatch()
    },
  }
}

/** fetch Response.body 를 끝까지 읽으며 이벤트를 전달한다. */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onMessage: (msg: SseMessage) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  const parser = createSseParser(onMessage)
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parser.feed(decoder.decode(value, { stream: true }))
    }
    parser.feed(decoder.decode())
    parser.flush()
  } finally {
    reader.releaseLock()
  }
}
