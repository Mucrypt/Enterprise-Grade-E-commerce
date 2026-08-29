// ============================================
// Mega Menu Component -- SHEIN-style icon-grid dropdown
// ============================================
// Real category-tree data end-to-end: every icon is a real, admin-uploaded
// category_media row (media_purpose='icon', uploaded via CategoryForm's
// existing Media tab -- no new admin work was needed, that upload already
// existed and was simply never surfaced here). A category with no icon
// uploaded yet gets a neutral initial-letter tile instead of a stock photo
// or placeholder image -- never fabricated imagery.
//
// Two render modes depending on what Header.tsx passes in:
//  - A single category (hovering one specific nav pill) -> one spacious
//    "SHOP BY CATEGORY" icon grid for just that category's children,
//    matching SHEIN's own per-category hover panel.
//  - The full category list (the generic "Categories" browse-everything
//    button) -> a fixed-height, two-pane master/detail panel: a scrollable
//    sidebar of every top-level category on the left, and the icon grid
//    for whichever one is hovered on the right -- SHEIN's own mechanic.
//    Stacking every category's full grid vertically (the previous
//    approach) grows taller than the viewport once there are more than a
//    handful of categories; a fixed-height two-pane layout stays compact
//    and complete no matter how large the catalog gets.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Category } from '../../types'

interface MegaMenuProps {
  categories: Category[]
}

function mediaUrl(category: Category, purpose: 'banner' | 'icon'): string | null {
  const media = category.media?.find((m) => m.media_purpose === purpose)
  return media?.cdn_urls?.medium || media?.file_path || media?.url || null
}

// Deterministic (not random) color per category so the same category
// always gets the same fallback tile color across renders/sessions.
const FALLBACK_PALETTE = [
  'bg-orange-100 text-orange-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-slate-100 text-slate-700',
]
function fallbackStyle(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length]
}

function CategoryIconTile({
  category,
  size = 'md',
}: {
  category: Category
  size?: 'md' | 'lg'
}) {
  const icon = mediaUrl(category, 'icon')
  const dim = size === 'lg' ? 'h-16 w-16' : 'h-12 w-12'
  return (
    <Link
      to={`/category/${category.slug}`}
      className="group flex flex-col items-center gap-2 text-center"
    >
      {icon ? (
        <span className={`${dim} overflow-hidden rounded-full border border-gray-100 shadow-sm transition-transform group-hover:scale-105`}>
          <img src={icon} alt={category.name} className="h-full w-full object-cover" />
        </span>
      ) : (
        <span
          className={`${dim} flex items-center justify-center rounded-full text-base font-bold transition-transform group-hover:scale-105 ${fallbackStyle(category.slug)}`}
        >
          {category.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="max-w-20 truncate text-xs font-medium text-gray-700 group-hover:text-orange-600">
        {category.name}
      </span>
    </Link>
  )
}

function ViewAllTile({ category, size = 'md' }: { category: Category; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-16 w-16' : 'h-12 w-12'
  return (
    <Link to={`/category/${category.slug}`} className="group flex flex-col items-center gap-2 text-center">
      <span className={`${dim} flex items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400 transition-colors group-hover:border-orange-400 group-hover:text-orange-500`}>
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </span>
      <span className="text-xs font-semibold text-gray-600 group-hover:text-orange-600">View All</span>
    </Link>
  )
}

// A real, currently-running admin-curated collection for a category takes
// priority over its plain banner -- it's a live promo, more actionable
// than a static image. Nothing renders when neither exists (see
// category.controller.ts's getCategories -- active_collections is already
// gated server-side to active/public/within-schedule rows).
function PromoSideBanner({ category }: { category: Category }) {
  const promo = category.active_collections?.[0]
  const promoImage = promo?.banner_url || promo?.image_url
  const banner = mediaUrl(category, 'banner')

  if (promo) {
    return (
      <Link
        to={`/collections/${promo.slug}`}
        className="group relative hidden w-72 shrink-0 overflow-hidden rounded-xl lg:block"
      >
        {promoImage ? (
          <>
            <img
              src={promoImage}
              alt={promo.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/80 via-black/10 to-transparent p-5">
              <span className="mb-1.5 w-fit rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Featured
              </span>
              <span className="text-base font-bold leading-snug text-white">{promo.name}</span>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col justify-end bg-linear-to-br from-gray-800 to-gray-950 p-5">
            <span className="mb-1.5 w-fit rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Featured
            </span>
            <span className="text-base font-bold text-white">{promo.name}</span>
          </div>
        )}
      </Link>
    )
  }

  if (banner) {
    return (
      <Link
        to={`/category/${category.slug}`}
        className="group hidden w-72 shrink-0 overflow-hidden rounded-xl lg:block"
      >
        <img
          src={banner}
          alt={category.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </Link>
    )
  }

  return null
}

// Shared by both the single-category panel and the two-pane browse panel's
// right side: the icon grid when the category has subcategories, or a
// graceful "shop the category directly" fallback when it's still flat.
function CategoryShopPanel({ category }: { category: Category }) {
  const children = category.children || []
  const icon = mediaUrl(category, 'icon')

  if (children.length === 0) {
    return (
      <div className="flex min-h-70 flex-1 items-center gap-6">
        {icon ? (
          <img
            src={icon}
            alt={category.name}
            className="h-20 w-20 shrink-0 rounded-full border border-gray-100 object-cover shadow-sm"
          />
        ) : (
          <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold ${fallbackStyle(category.slug)}`}>
            {category.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <p className="text-lg font-bold text-gray-900">{category.name}</p>
          <Link
            to={`/category/${category.slug}`}
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            Shop {category.name}
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-70 flex-1">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Shop {category.name}
        </p>
        <Link
          to={`/category/${category.slug}`}
          className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
        >
          View all
          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-x-6 gap-y-8 sm:grid-cols-5 xl:grid-cols-6">
        <ViewAllTile category={category} size="lg" />
        {children.map((child) => (
          <CategoryIconTile key={child.id} category={child} size="lg" />
        ))}
      </div>
    </div>
  )
}

// Generic "Categories" browse-everything panel. Fixed height, two-pane
// master/detail (SHEIN's own mechanic): a scrollable sidebar lists every
// top-level category; the icon grid on the right always shows whichever
// one is currently hovered (or clicked, for keyboard/touch users), so the
// panel's footprint stays constant and compact no matter how many
// categories or subcategories the catalog grows to.
function CategoriesBrowsePanel({ categories }: { categories: Category[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = categories[activeIndex] ?? categories[0]

  return (
    <div className="container mx-auto px-4">
      <div className="flex h-115 overflow-hidden rounded-b-lg border border-t-0 border-gray-100">
        {/* Left: every top-level category */}
        <div className="w-64 shrink-0 overflow-y-auto border-r border-gray-100 bg-gray-50/70 py-3">
          {categories.map((category, index) => {
            const isActive = index === activeIndex
            const icon = mediaUrl(category, 'icon')
            return (
              <Link
                key={category.id}
                to={`/category/${category.slug}`}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-white font-semibold text-orange-600 shadow-[inset_3px_0_0_0_#f97316]'
                    : 'text-gray-700 hover:bg-white/80'
                }`}
              >
                {icon ? (
                  <img src={icon} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${fallbackStyle(category.slug)}`}>
                    {category.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="flex-1 truncate">{category.name}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className={`h-3.5 w-3.5 shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )
          })}
        </div>

        {/* Right: the active category's shop panel + promo/banner */}
        <div className="flex flex-1 gap-10 overflow-y-auto px-10 py-8">
          <CategoryShopPanel category={active} />
          <PromoSideBanner category={active} />
        </div>
      </div>
    </div>
  )
}

export default function MegaMenu({ categories }: MegaMenuProps) {
  if (categories.length === 0) return null

  // Single-category hover: one spacious panel, mirrors SHEIN's own
  // per-category dropdown (a "SHOP BY CATEGORY" icon grid).
  if (categories.length === 1) {
    const category = categories[0]
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="flex gap-10">
          <CategoryShopPanel category={category} />
          <PromoSideBanner category={category} />
        </div>
      </div>
    )
  }

  return <CategoriesBrowsePanel categories={categories} />
}
