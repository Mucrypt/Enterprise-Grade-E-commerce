import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, X, ZoomIn } from 'lucide-react'
import type { ProductMedia } from '../../types'
import { cn } from '../../utils'

interface ImageGalleryProps {
  items: ProductMedia[]
  productName: string
  badges?: React.ReactNode
  actions?: React.ReactNode
}

const SWIPE_THRESHOLD_PX = 50

export function ImageGallery({ items, productName, badges, actions }: ImageGalleryProps) {
  const [selected, setSelected] = useState(0)
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 })
  const [zooming, setZooming] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const active = items[selected]
  const isVideo = active?.type === 'video'

  const goPrev = () => setSelected((prev) => (prev - 1 + items.length) % items.length)
  const goNext = () => setSelected((prev) => (prev + 1) % items.length)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setZoomPos({ x, y })
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || items.length <= 1) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta > SWIPE_THRESHOLD_PX) goPrev()
    else if (delta < -SWIPE_THRESHOLD_PX) goNext()
    touchStartX.current = null
  }

  return (
    <div className='space-y-4'>
      <div
        className='relative aspect-square overflow-hidden rounded-2xl bg-white shadow-sm'
        onMouseEnter={() => !isVideo && setZooming(true)}
        onMouseLeave={() => setZooming(false)}
        onMouseMove={!isVideo ? handleMouseMove : undefined}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {isVideo ? (
          <video
            src={active.url}
            controls
            className='h-full w-full object-contain p-6'
            poster={active.cdn_urls?.thumbnail}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <>
            <button
              type='button'
              onClick={() => setLightboxOpen(true)}
              className='block h-full w-full cursor-zoom-in'
              aria-label={`View larger image of ${productName}`}
            >
              <img
                src={active?.url}
                alt={active?.alt_text || productName}
                className='h-full w-full object-contain p-6'
              />
            </button>
            {/* Desktop hover-zoom lens -- a second, magnified layer of the
                same image, positioned by cursor location. Doesn't fire on
                touch devices (no mousemove there), so mobile just gets the
                lightbox via tap. */}
            {zooming && (
              <div
                className='pointer-events-none absolute inset-0 hidden bg-white bg-no-repeat md:block'
                style={{
                  backgroundImage: `url(${active?.url})`,
                  backgroundSize: '200%',
                  backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                }}
              />
            )}
            <div className='pointer-events-none absolute bottom-4 right-4 hidden items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-xs text-white md:flex'>
              <ZoomIn className='h-3 w-3' /> Hover to zoom
            </div>
          </>
        )}

        {items.length > 1 && (
          <>
            <button
              type='button'
              onClick={goPrev}
              aria-label='Previous image'
              className='absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg hover:bg-white'
            >
              <ChevronLeft className='h-5 w-5' />
            </button>
            <button
              type='button'
              onClick={goNext}
              aria-label='Next image'
              className='absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg hover:bg-white'
            >
              <ChevronRight className='h-5 w-5' />
            </button>
          </>
        )}

        {badges && <div className='absolute left-4 top-4 flex flex-col gap-2'>{badges}</div>}
        {actions && <div className='absolute right-4 top-4 flex flex-col gap-2'>{actions}</div>}
      </div>

      {items.length > 1 && (
        <div className='flex gap-3 overflow-x-auto pb-2'>
          {items.map((item, index) => (
            <button
              key={item.id || index}
              type='button'
              onClick={() => setSelected(index)}
              aria-label={`View ${item.type === 'video' ? 'video' : 'image'} ${index + 1}`}
              aria-current={selected === index}
              className={cn(
                'relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                selected === index ? 'border-orange-500' : 'border-transparent hover:border-gray-300',
              )}
            >
              {item.type === 'video' ? (
                <>
                  <video src={item.url} className='h-full w-full object-cover' muted />
                  <div className='absolute inset-0 flex items-center justify-center bg-black/30'>
                    <Play className='h-6 w-6 fill-white text-white' />
                  </div>
                </>
              ) : (
                <img
                  src={item.url}
                  alt={item.alt_text || `${productName} ${index + 1}`}
                  className='h-full w-full object-cover'
                />
              )}
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && !isVideo && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4'
          role='dialog'
          aria-modal='true'
          aria-label={`${productName} full-size image`}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type='button'
            onClick={() => setLightboxOpen(false)}
            aria-label='Close full-size image'
            className='absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20'
          >
            <X className='h-6 w-6' />
          </button>
          <img
            src={active?.url}
            alt={active?.alt_text || productName}
            className='max-h-full max-w-full object-contain'
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
