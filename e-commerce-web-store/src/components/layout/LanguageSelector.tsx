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

import { useEffect, useRef, useState } from 'react'
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

export default function LanguageSelector() {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  // Which menu item currently has DOM focus -- a ref, not state: it only
  // ever drives an imperative .focus() call, never anything React needs to
  // re-render for, so making it state would just invite exactly the
  // setState-in-effect anti-pattern below.
  const activeIndexRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const currentLocale = (i18n.language as SupportedLocale) || 'en'

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
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
    <div ref={containerRef} className='relative'>
      <button
        ref={buttonRef}
        type='button'
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup='menu'
        aria-expanded={isOpen}
        aria-label={`Language: ${LOCALE_LABELS[currentLocale]}. Click to change.`}
        className='flex items-center gap-1.5 hover:text-white transition-colors'
      >
        <Globe className='w-3.5 h-3.5' aria-hidden='true' />
        <span>{LOCALE_LABELS[currentLocale]}</span>
      </button>

      {isOpen && (
        <div
          role='menu'
          aria-label='Select language'
          onKeyDown={handleMenuKeyDown}
          className='absolute right-0 top-full mt-2 w-40 bg-white text-gray-900 rounded-lg shadow-xl border border-gray-100 py-1 z-50'
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
                'w-full flex items-center justify-between px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors',
                locale === currentLocale && 'font-semibold',
              )}
            >
              {LOCALE_LABELS[locale]}
              {locale === currentLocale && (
                <Check className='w-4 h-4 text-orange-500' aria-hidden='true' />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
