import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { accountsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import type { BaselineInfo } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { formatMoney, groupDigits, type CurrencyCode } from '@/lib/format'
import { parseAmountInput } from '@/lib/pnl'

/** 기준 자산(원금) 설정. 총자산이 기준보다 얼마 늘었는지를 계산하는 데 쓰는 금액이다. */
export function BaselineDialog({
  open,
  onClose,
  accountId,
  currency,
  baseline,
  totalAssets,
}: {
  open: boolean
  onClose: () => void
  accountId: number
  currency: CurrencyCode
  baseline?: BaselineInfo | null
  totalAssets: number
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [text, setText] = useState('')

  useEffect(() => {
    if (!open) return
    const start = baseline?.amount ?? totalAssets
    setText(start > 0 ? groupDigits(String(currency === 'USD' ? Number(start.toFixed(2)) : Math.round(start))) : '')
  }, [open, baseline?.amount, totalAssets, currency])

  const save = useMutation({
    mutationFn: (amount: number | null) => accountsApi.setBaseline(accountId, { currency, amount }),
    onSuccess: (_d, amount) => {
      qc.invalidateQueries({ queryKey: ['summary', accountId] })
      toast.success(amount == null ? '지금 총자산을 기준으로 다시 잡았어요.' : '기준 자산을 저장했어요.')
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const amount = parseAmountInput(text)
  const unit = currency === 'USD' ? '달러' : '원'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="기준 자산 설정"
      size="sm"
      description="총자산이 기준 자산보다 얼마나 늘었는지(손익과 수익률)를 계산하는 데 쓰는 금액이에요."
      footer={
        <>
          <Button variant="secondary" onClick={() => save.mutate(null)} disabled={save.isPending}>
            지금 총자산으로 초기화
          </Button>
          <Button variant="primary" onClick={() => amount != null && save.mutate(amount)} loading={save.isPending} disabled={amount == null}>
            저장
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field
          label={`기준 자산 (${currency === 'USD' ? 'USD' : 'KRW'})`}
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(groupDigits(e.target.value))}
          suffix={<span className="px-2 text-sm text-subtle">{unit}</span>}
          data-autofocus
          error={text && amount == null ? '0보다 큰 숫자를 입력해 주세요.' : null}
          hint={baseline ? `지금 기준: ${formatMoney(baseline.amount, currency)}` : undefined}
        />
        <ul className="list-disc space-y-1 pl-4 text-xs text-subtle">
          <li>증권사는 투자 원금을 알려 주지 않아서, 이 서비스가 계좌를 처음 조회한 시점의 총자산을 자동으로 기준으로 잡아 둬요.</li>
          <li>입금·출금이 있었다면 그만큼을 반영한 투자 원금을 직접 입력해 주세요. 그렇지 않으면 손익이 실제와 달라져요.</li>
          <li>모의투자 계좌는 처음 받은 투자금(예: 1억 원)을 입력하면 정확해요.</li>
        </ul>
      </div>
    </Dialog>
  )
}
