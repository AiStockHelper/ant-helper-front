import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, setStepUpHandler } from './client'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('step-up (실계좌 보호용 이메일 인증)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    })
  })

  afterEach(() => {
    setStepUpHandler(null)
    vi.unstubAllGlobals()
  })

  it('S-010 을 받으면 인증을 거친 뒤 같은 요청을 한 번 더 보낸다', async () => {
    fetchMock
      .mockResolvedValueOnce(json(403, { isSuccess: false, code: 'S-010', message: '인증이 필요합니다.' }))
      .mockResolvedValueOnce(json(200, { isSuccess: true, data: { id: 1 } }))
    const handler = vi.fn().mockResolvedValue(true)
    setStepUpHandler(handler)

    const result = await api.post<{ id: number }>('/accounts', { a: 1 })

    expect(result).toEqual({ id: 1 })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('인증을 취소하면 원래 오류를 그대로 던지고 재요청하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(json(403, { isSuccess: false, code: 'S-010', message: '인증이 필요합니다.' }))
    setStepUpHandler(vi.fn().mockResolvedValue(false))

    await expect(api.post('/accounts', {})).rejects.toMatchObject({ status: 403, code: 'S-010' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('다른 403 은 인증 창을 띄우지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(json(403, { isSuccess: false, code: 'C-005', message: '권한이 없습니다.' }))
    const handler = vi.fn().mockResolvedValue(true)
    setStepUpHandler(handler)

    await expect(api.get('/x')).rejects.toBeInstanceOf(ApiError)
    expect(handler).not.toHaveBeenCalled()
  })
})
