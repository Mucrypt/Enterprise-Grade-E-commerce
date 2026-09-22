// ============================================
// TechTools Logo
// ============================================
// Single source of truth for the brand mark -- previously a CSS-drawn
// gradient square with a plain "T" character, hand-duplicated across
// Header/Footer/LoginPage/RegisterPage with drifting sizes. Now a real
// image (the same TT mark used as the mobile app's icon and this site's
// own favicon/PWA icons), rendered at one consistent size scale and one
// consistent wordmark treatment everywhere it appears.
//
// wordmarkVariant='brand' intentionally uses the default Tailwind
// orange-500/red-500 (not a "brand-orange" token) -- tailwind.config.js
// defines a brand.orange/brand.red pair, but this project is on
// Tailwind v4, which reads theme from src/index.css's @theme block, not
// tailwind.config.js (see that file's own comment on the same dead-config
// issue with the animate-* utilities). The real live brand scale there
// is a numeric brand-50..950 ramp with no orange/red aliases, and its
// base (brand-500, #f97316) doesn't even match the token in the dead
// config (#FF6B35) either way -- so there is no reliably-wired custom
// brand color to reach for here. orange-500/red-500 is what the
// original hand-drawn logos already used everywhere, proven to render.

import { Link } from 'react-router-dom'
import logoMark from '../../assets/logo.png'
import { cn } from '../../utils'

const SIZE_CLASSES = {
  sm: 'h-8 w-8 sm:h-9 sm:w-9',
  md: 'h-10 w-10 sm:h-11 sm:w-11',
  lg: 'h-12 w-12',
} as const

const WORDMARK_SIZE_CLASSES = {
  sm: 'text-lg sm:text-xl',
  md: 'text-xl sm:text-2xl',
  lg: 'text-2xl',
} as const

export interface LogoProps {
  size?: keyof typeof SIZE_CLASSES
  /** Show the "TechTools" wordmark next to the mark. Default true. */
  showWordmark?: boolean
  /** 'brand': orange-to-red gradient text, matches the mark's own colors (auth pages).
   *  'dark' (default): a subtler gray gradient, for the busy main nav bar.
   *  'light': plain white text, for dark backgrounds (the footer). */
  wordmarkVariant?: 'brand' | 'dark' | 'light'
  className?: string
  /** Renders a plain span instead of a Link, for contexts already inside a link/button. */
  as?: 'link' | 'span'
}

export default function Logo({
  size = 'md',
  showWordmark = true,
  wordmarkVariant = 'dark',
  className,
  as = 'link',
}: LogoProps) {
  const content = (
    <>
      <img
        src={logoMark}
        alt='TechTools'
        className={cn(SIZE_CLASSES[size], 'rounded-xl object-contain shrink-0')}
      />
      {showWordmark && (
        <span
          className={cn(
            WORDMARK_SIZE_CLASSES[size],
            'font-bold',
            wordmarkVariant === 'brand' &&
              'bg-linear-to-r from-orange-500 to-red-500 bg-clip-text text-transparent',
            wordmarkVariant === 'dark' &&
              'bg-linear-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent',
            wordmarkVariant === 'light' && 'text-white',
          )}
        >
          TechTools
        </span>
      )}
    </>
  )

  const wrapperClass = cn('inline-flex items-center gap-2', className)

  if (as === 'span') {
    return <span className={wrapperClass}>{content}</span>
  }

  return (
    <Link to='/' className={wrapperClass}>
      {content}
    </Link>
  )
}
