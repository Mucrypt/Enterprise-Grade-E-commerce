// ============================================
// Promo Drawer -- "Hot Right Now"
//
// A global, GSAP-animated slide-out drawer surfacing whatever real
// products the team has added to the "Hot Right Now" product_collection
// (managed entirely from the existing Collections admin page -- no new
// admin UI). A small edge tab is the only thing visible on every page;
// clicking it slides the drawer in from the left with GSAP, staggering
// each product card in behind it.
//
// Renders nothing at all -- not even the edge tab -- when the
// collection is inactive or has zero real products, matching this
// codebase's honest-empty-state discipline (this can never show a
// placeholder or fabricated "hot" product).
//
// Business intent: a persistent, low-friction surface for whatever the
// team is actively running ads on, plus a soft account-creation nudge
// for signed-out visitors who open it.
// ============================================

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, X, UserPlus } from 'lucide-react'
import gsap from 'gsap'
import { collectionsApi } from '../../api'
import { useAuthStore } from '../../stores'
import type { Product } from '../../types'
import PromoProductCard from './PromoProductCard'

const COLLECTION_SLUG = 'hot-right-now'

export default function PromoDrawer() {
  const [products, setProducts] = useState<Product[]>([])
  const [collectionName, setCollectionName] = useState('Hot Right Now')
  const [ready, setReady] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const { isAuthenticated } = useAuthStore()

  const panelRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const collection = await collectionsApi.getBySlug(COLLECTION_SLUG)
        if (cancelled) return
        const active = (collection.products || []).filter((p) => p.is_active)
        setProducts(active)
        setCollectionName(collection.name)
      } catch {
        // Collection missing/inactive -- stay empty, drawer never renders.
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // GSAP open/close: slide the panel in from the left with an
  // overlay fade, then stagger the product cards in behind it.
  useEffect(() => {
    if (!panelRef.current || !overlayRef.current) return

    const cardEls = cardsRef.current
      ? Array.from(cardsRef.current.children)
      : []

    if (isOpen) {
      const tl = gsap.timeline()
      tl.to(overlayRef.current, { autoAlpha: 1, duration: 0.25, ease: 'power2.out' })
      tl.to(
        panelRef.current,
        { x: 0, duration: 0.45, ease: 'power3.out' },
        '<',
      )
      if (cardEls.length > 0) {
        tl.fromTo(
          cardEls,
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.06, ease: 'power2.out' },
          '-=0.2',
        )
      }
    } else {
      gsap.to(panelRef.current, { x: '-100%', duration: 0.35, ease: 'power2.in' })
      gsap.to(overlayRef.current, { autoAlpha: 0, duration: 0.25, ease: 'power2.in' })
    }
  }, [isOpen, products.length])

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  if (!ready || products.length === 0) return null

  return (
    <>
      {/* Edge tab trigger */}
      <button
        type='button'
        onClick={() => setIsOpen(true)}
        aria-label={`Open ${collectionName}`}
        className='fixed left-0 top-1/2 z-40 -translate-y-1/2 rounded-r-lg bg-slate-900 px-2 py-4 text-white shadow-lg transition-colors hover:bg-orange-600'
      >
        <span className='flex flex-col items-center gap-1.5'>
          <Flame className='h-4 w-4 fill-orange-500 text-orange-500' aria-hidden='true' />
          <span
            className='text-[10px] font-bold uppercase tracking-wide'
            style={{ writingMode: 'vertical-rl' }}
          >
            Hot Deals
          </span>
        </span>
      </button>

      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={() => setIsOpen(false)}
        className='fixed inset-0 z-40 bg-black/50 opacity-0'
        style={{ visibility: 'hidden' }}
        aria-hidden={!isOpen}
      />

      {/* Sliding panel */}
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-label={collectionName}
        className='fixed inset-y-0 left-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl'
        style={{ transform: 'translateX(-100%)' }}
      >
        <div className='flex items-center justify-between border-b border-slate-100 px-5 py-4'>
          <div className='flex items-center gap-2'>
            <Flame className='h-5 w-5 fill-orange-500 text-orange-500' aria-hidden='true' />
            <h2 className='text-lg font-black text-slate-900'>{collectionName}</h2>
          </div>
          <button
            type='button'
            onClick={() => setIsOpen(false)}
            aria-label='Close'
            className='rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        {!isAuthenticated && (
          <Link
            to='/register'
            onClick={() => setIsOpen(false)}
            className='mx-5 mt-4 flex items-center gap-3 rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-800 hover:bg-orange-100'
          >
            <UserPlus className='h-5 w-5 shrink-0' aria-hidden='true' />
            Create a free account to save your picks & get first access to drops
          </Link>
        )}

        <div className='flex-1 overflow-y-auto px-5 py-4'>
          <div ref={cardsRef} className='grid grid-cols-2 gap-3'>
            {products.slice(0, 8).map((product) => (
              <PromoProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>

        <div className='border-t border-slate-100 px-5 py-4'>
          <Link
            to={`/collections/${COLLECTION_SLUG}`}
            onClick={() => setIsOpen(false)}
            className='block rounded-lg bg-slate-900 py-2.5 text-center text-sm font-bold text-white hover:bg-orange-600'
          >
            See All Hot Picks
          </Link>
        </div>
      </div>
    </>
  )
}
