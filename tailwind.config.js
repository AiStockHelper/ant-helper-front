const c = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    screens: {
      sm: '640px',
      md: '769px',
      lg: '1024px',
      xl: '1280px',
    },
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        'surface-2': c('surface-2'),
        'surface-3': c('surface-3'),
        border: c('border'),
        'border-strong': c('border-strong'),
        fg: c('fg'),
        muted: c('fg-muted'),
        subtle: c('fg-subtle'),
        brand: {
          DEFAULT: c('brand'),
          hover: c('brand-hover'),
          soft: c('brand-soft'),
          fg: c('brand-fg'),
          text: c('brand-text'),
        },
        up: { DEFAULT: c('up'), soft: c('up-soft') },
        down: { DEFAULT: c('down'), soft: c('down-soft') },
        real: { DEFAULT: c('real'), soft: c('real-soft'), solid: c('real-solid') },
        paper: { DEFAULT: c('paper'), soft: c('paper-soft') },
        success: { DEFAULT: c('success'), soft: c('success-soft') },
        danger: { DEFAULT: c('danger'), soft: c('danger-soft') },
        warning: { DEFAULT: c('warning'), soft: c('warning-soft') },
      },
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Malgun Gothic',
          'Apple SD Gothic Neo',
          'Noto Sans KR',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.06)',
        pop: '0 8px 30px rgb(0 0 0 / 0.14)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(0.97)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        caret: { '0%,49%': { opacity: '1' }, '50%,100%': { opacity: '0' } },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out both',
        'slide-in-left': 'slide-in-left 0.22s ease-out both',
        'slide-up': 'slide-up 0.22s ease-out both',
        'pop-in': 'pop-in 0.15s ease-out both',
        caret: 'caret 1s steps(1) infinite',
      },
    },
  },
  plugins: [],
}
