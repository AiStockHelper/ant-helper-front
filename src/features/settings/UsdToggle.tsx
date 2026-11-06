import { ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { UsdDisplay } from '@/lib/format'
import { useCurrencyDisplay } from './CurrencyDisplayContext'

const OPTIONS: { value: UsdDisplay; label: string }[] = [
  { value: 'USD', label: '달러' },
  { value: 'KRW', label: '원' },
  { value: 'BOTH', label: '둘 다' },
]

/** 해외 종목 금액을 달러로 볼지 원화로 볼지 바로 바꾸는 작은 스위치 */
export function UsdToggle({ className }: { className?: string }) {
  const { mode, setMode, rate } = useCurrencyDisplay()
  return (
    <div
      role="radiogroup"
      aria-label="해외 종목 금액 보기"
      title={rate ? `1달러 = ${rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원 기준으로 환산해요` : '환율을 아직 가져오지 못했어요. 달러로 보여 드려요'}
      className={cn('inline-flex items-center gap-1 rounded-xl bg-surface-2 p-0.5 text-xs', className)}
    >
      <ArrowLeftRight className="ml-1.5 h-3.5 w-3.5 text-subtle" aria-hidden />
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          onClick={() => setMode(o.value)}
          className={cn(
            'h-7 rounded-lg px-2 font-medium transition-colors',
            mode === o.value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}