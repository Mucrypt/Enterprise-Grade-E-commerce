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
//    button) -> one compact section per top-level category, each with its
//    own small icon row, so the whole catalog is scannable at once.

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

export default function MegaMenu({ categories }: MegaMenuProps) {
  if (categories.length === 0) return null

  const hasAnyChildren = categories.some((c) => (c.children?.length || 0) > 0)
  if (!hasAnyChildren && categories.length === 1) {
    return null
  }

  // Single-category hover: one spacious panel, mirrors SHEIN's own
  // per-category dropdown (a "SHOP BY CATEGORY" icon grid).
  if (categories.length === 1) {
    const category = categories[0]
    const children = category.children || []
    // A real, currently-running admin-curated collection for this
    // category takes priority over the plain category banner -- it's a
    // live promo, more actionable than a static image. Absent entirely
    // when nothing real is running (see category.controller.ts's
    // getCategories -- this array is already gated to active/public/
    // within-schedule collections server-side).
    const promo = category.active_collections?.[0]
    const promoImage = promo?.banner_url || promo?.image_url
    const banner = mediaUrl(category, 'banner')

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-10">
          <div className="flex-1">
            <p className="mb-5 text-xs font-bold uppercase tracking-widest text-gray-400">
              Shop {category.name}
            </p>
            <div className="grid grid-cols-4 gap-x-4 gap-y-6 sm:grid-cols-6 lg:grid-cols-8">
              <ViewAllTile category={category} size="lg" />
              {children.map((child) => (
                <CategoryIconTile key={child.id} category={child} size="lg" />
              ))}
            </div>
          </div>
          {promo ? (
            <Link
              to={`/collections/${promo.slug}`}
              className="group hidden w-64 shrink-0 overflow-hidden rounded-lg lg:block"
            >
              {promoImage ? (
                <div className="relative h-full w-full">
                  <img
                    src={promoImage}
                    alt={promo.name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-end bg-linear-to-t from-black/70 to-transparent p-4">
                    <span className="text-sm font-bold text-white">{promo.name}</span>
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col justify-end bg-gray-900 p-4">
                  <span className="text-sm font-bold text-white">{promo.name}</span>
                </div>
              )}
            </Link>
          ) : (
            banner && (
              <Link
                to={`/category/${category.slug}`}
                className="hidden w-64 shrink-0 overflow-hidden rounded-lg lg:block"
              >
                <img src={banner} alt={category.name} className="h-full w-full object-cover" />
              </Link>
            )
          )}
        </div>
      </div>
    )
  }

  // Generic "Categories" browse-everything panel: one compact section per
  // top-level category. Real catalogs are often flat (no subcategories
  // yet) -- the section still shows up as a direct link to the category
  // itself; the icon row only renders once real subcategories exist.
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => {
          const children = category.children || []

          return (
            <div key={category.id}>
              <Link
                to={`/category/${category.slug}`}
                className="mb-3 block text-sm font-bold uppercase tracking-wide text-gray-900 hover:text-orange-600"
              >
                {category.name}
              </Link>
              {children.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {children.slice(0, 8).map((child) => (
                    <CategoryIconTile key={child.id} category={child} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
