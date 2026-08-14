// ============================================
// Language Selector -- navbar globe/language menu
// ============================================
// A plain button + roving-focus menu (no external headless-UI dependency
// installed in this app yet -- see docs/LOCALIZATION-ARCHITECTURE.md for
// why one wasn't pulled in just for this). Built to the same accessibility
// bar Radix/Headless UI would give: role="menu"/"menuitem", full keyboard
// support (Enter/Space to open, Arrow keys to move, Escape/outside-click
// to close, focus returns to the trigger on close), and an aria-label so
// screen readers announce it as a language picker, not just "button".
//
// The menu is rendered through a portal into document.body, positioned
// with `fixed` coordinates computed from the trigger button's own bounding
// rect, rather than as an `absolute`-positioned child of the trigger's
// container. The trigger lives in the top utility bar, which sits earlier
// in the DOM than the main `<header>` -- a plain (non-positioned) div, so
// it creates no stacking context of its own, which means an `absolute`
// child menu ends up competing directly against the sticky header (itself
// z-50) as a sibling in the page's root stacking context. Same z-index,
// later DOM order wins: the header (opaque, taller) painted over the top
// of the menu, exactly matching the "only the last two languages are
// visible" bug. Portaling to document.body with `fixed` positioning and a
// z-index above every sticky/overlay layer in this app sidesteps the
// entire class of stacking-context bugs permanently -- it can never again
// be clipped by a z-index or position change made somewhere else in the
// header, which is the same reason real popover libraries always portal.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Globe, Check } from 'lucide-react'
import { changeLanguage } from '../../i18n'
import { SUPPORTED_LOCALES, type SupportedLocale } from '../../i18n/resolveLocale'
import { cn } from '../../utils'

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  it: 'Italiano',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
}

interface MenuPosition {
  top: number
  right: number
}

export default function LanguageSelector() {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  // Which menu item currently has DOM focus -- a ref, not state: it only
  // ever drives an imperative .focus() call, never anything React needs to
  // re-render for, so making it state would just invite exactly the
  // setState-in-effect anti-pattern below.
  const activeIndexRef = useRef(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const currentLocale = (i18n.language as SupportedLocale) || 'en'

  const computePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    })
  }

  // Computed directly in the click handler below (an event handler, not an
  // effect) -- buttonRef.current is already mounted by the time it's
  // clickable, so the position is known synchronously before the menu ever
  // renders. No first-frame flash, and no setState-in-effect to avoid.
  const openMenu = () => {
    computePosition()
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const clickedButton = buttonRef.current?.contains(target)
      const clickedMenu = menuRef.current?.contains(target)
      if (!clickedButton && !clickedMenu) setIsOpen(false)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }
    // The trigger lives in a non-sticky bar that scrolls out of view --
    // closing on scroll avoids leaving an orphaned menu anchored to a
    // button that's no longer where the menu points at.
    const handleScroll = () => setIsOpen(false)
    const handleResize = () => computePosition()

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    window.addEventListener('resize', handleResize)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      const currentIndex = SUPPORTED_LOCALES.indexOf(currentLocale)
      const index = currentIndex >= 0 ? currentIndex : 0
      activeIndexRef.current = index
      itemRefs.current[index]?.focus()
    }
  }, [isOpen, currentLocale])

  const select = (locale: SupportedLocale) => {
    changeLanguage(locale, true)
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = (activeIndexRef.current + 1) % SUPPORTED_LOCALES.length
      activeIndexRef.current = next
      itemRefs.current[next]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const prev =
        (activeIndexRef.current - 1 + SUPPORTED_LOCALES.length) % SUPPORTED_LOCALES.length
      activeIndexRef.current = prev
      itemRefs.current[prev]?.focus()
    }
  }

  return (
    <div className='relative'>
      <button
        ref={buttonRef}
        type='button'
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        aria-haspopup='menu'
        aria-expanded={isOpen}
        aria-label={`Language: ${LOCALE_LABELS[currentLocale]}. Click to change.`}
        className='flex items-center gap-1.5 hover:text-white transition-colors'
      >
        <Globe className='w-3.5 h-3.5' aria-hidden='true' />
        <span>{LOCALE_LABELS[currentLocale]}</span>
      </button>

      {isOpen && position &&
        createPortal(
          <div
            ref={menuRef}
            role='menu'
            aria-label='Select language'
            onKeyDown={handleMenuKeyDown}
            style={{ top: position.top, right: position.right }}
            className='fixed z-70 w-44 origin-top-right animate-fade-in overflow-hidden rounded-xl border border-gray-100 bg-white py-1.5 text-gray-900 shadow-2xl ring-1 ring-black/5'
          >
            {SUPPORTED_LOCALES.map((locale, index) => (
              <button
                key={locale}
                ref={(el) => {
                  itemRefs.current[index] = el
                }}
                role='menuitemradio'
                aria-checked={locale === currentLocale}
                tabIndex={-1}
                onClick={() => select(locale)}
                className={cn(
                  'flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-orange-50 focus-visible:bg-orange-50 focus-visible:outline-none',
                  locale === currentLocale ? 'font-semibold text-orange-600' : 'text-gray-700',
                )}
              >
                {LOCALE_LABELS[locale]}
                {locale === currentLocale && (
                  <Check className='h-4 w-4 text-orange-500' aria-hidden='true' />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
