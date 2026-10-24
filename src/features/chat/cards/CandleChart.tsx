import { useMemo, useRef, useState } from 'react'
import { formatAmount, formatVolume, type CurrencyCode } from '@/lib/format'
import type { Candle } from '@/api/types'

const W = 600
const H = 220
const VOL_H = 40
const PAD_T = 8
const PAD_B = 4

/** 직접 그리는 SVG 캔들 차트 (상승=빨강, 하락=파랑) + 거래량. 포인터로 값 확인 */
export function CandleChart({ candles, currency = 'KRW' }: { candles: Candle[]; currency?: CurrencyCode }) {
  const fmt = (n: number) => formatAmount(n, currency)
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)

  const calc = useMemo(() => {
    const hi = Math.max(...candles.map((c) => c.high))
    const lo = Math.min(...candles.map((c) => c.low))
    const range = hi - lo || 1
    const vmax = Math.max(...candles.map((c) => c.volume), 1)
    const chartH = H - VOL_H - PAD_T - PAD_B - 6
    const y = (v: number) => PAD_T + (1 - (v - lo) / range) * chartH
    const step = W / candles.length
    return { hi, lo, vmax, y, step, chartH }
  }, [candles])

  if (candles.length === 0) return null

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const idx = Math.floor(((e.clientX - rect.left) / rect.width) * candles.length)
    setHover(Math.max(0, Math.min(candles.length - 1, idx)))
  }

  const active = hover != null ? candles[hover] : candles[candles.length - 1]
  const prev = hover != null ? candles[hover - 1] : candles[candles.length - 2]
  const activeTone = prev ? (active.close >= prev.close ? 'text-up' : 'text-down') : 'text-fg'
  const gridLines = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div>
      <div className="tabular mb-1.5 flex min-h-[20px] flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
        <span className="font-medium text-fg">{active.date}</span>
        <span>시 {fmt(active.open)}</span>
        <span>고 {fmt(active.high)}</span>
        <span>저 {fmt(active.low)}</span>
        <span className={activeTone}>종 {fmt(active.close)}</span>
        <span>량 {formatVolume(active.volume)}</span>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-44 w-full touch-pan-y select-none sm:h-52"
        role="img"
        aria-label={`일봉 차트, 최근 ${candles.length}일`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {gridLines.map((g) => {
          const yy = PAD_T + g * calc.chartH
          return <line key={g} x1={0} x2={W} y1={yy} y2={yy} stroke="rgb(var(--border))" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        })}
        {candles.map((c, i) => {
          const up = c.close >= c.open
          const color = up ? 'rgb(var(--up))' : 'rgb(var(--down))'
          const cx = i * calc.step + calc.step / 2
          const bw = Math.max(1.5, calc.step * 0.62)
          const top = calc.y(Math.max(c.open, c.close))
          const bottom = calc.y(Math.min(c.open, c.close))
          const vh = (c.volume / calc.vmax) * VOL_H
          return (
            <g key={c.date} opacity={hover != null && hover !== i ? 0.55 : 1}>
              <line x1={cx} x2={cx} y1={calc.y(c.high)} y2={calc.y(c.low)} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(1, bottom - top)} fill={color} />
              <rect x={cx - bw / 2} y={H - vh} width={bw} height={vh} fill={color} opacity={0.35} />
            </g>
          )
        })}
        {hover != null && (
          <line
            x1={hover * calc.step + calc.step / 2}
            x2={hover * calc.step + calc.step / 2}
            y1={0}
            y2={H}
            stroke="rgb(var(--fg-subtle))"
            strokeDasharray="3 3"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="tabular mt-1 flex justify-between text-[11px] text-subtle">
        <span>{candles[0].date}</span>
        <span>
          최고 {fmt(calc.hi)} · 최저 {fmt(calc.lo)}
        </span>
        <span>{candles[candles.length - 1].date}</span>
      </div>
    </div>
  )
}
