// ============================================
// Mega Menu Component
// ============================================
// Dynamic, real category-tree data -- was previously a hardcoded object
// with only 6 fixed categories (2 of which, "interior"/"performance",
// weren't even in it and silently fell back to a generic panel) and
// placeholder images standing in for real ones. Renders one section per
// category passed in, using each category's real children as links and
// real category_media (banner/icon) when the admin has uploaded one --
// never a placeholder.

import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Category } from '../../types'

interface MegaMenuProps {
  /** One or more top-level categories to render as sections -- a single
   * category (its children become the section's links) for a specific
   * nav-item hover, or the full nav-eligible list for the generic
   * "Categories" browse-everything panel. */
  categories: Category[]
}

function mediaUrl(category: Category, purpose: 'banner' | 'icon'): string | null {
  const media = category.media?.find((m) => m.media_purpose === purpose)
  return media?.cdn_urls?.medium || media?.file_path || media?.url || null
}

export default function MegaMenu({ categories }: MegaMenuProps) {
  if (categories.length === 0) return null

  // A single hovered category with no children navigates straight there on
  // click already (it's a real <Link> in the nav bar itself) -- a dropdown
  // with nothing under it would just be an empty box, so don't open one.
  const hasAnyChildren = categories.some((c) => (c.children?.length || 0) > 0)
  if (!hasAnyChildren && categories.length === 1) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => {
          const children = category.children || []
          const banner = mediaUrl(category, 'banner')

          return (
            <div key={category.id}>
              <Link
                to={`/category/${category.slug}`}
                className="mb-3 block text-sm font-bold uppercase tracking-wide text-gray-900 hover:text-orange-600"
              >
                {category.name}
              </Link>
              {/* Real catalogs are often flat (no subcategories yet) --
                  this section still shows up as a direct link to the
                  category itself rather than disappearing entirely; the
                  child list only renders once real subcategories exist. */}
              {children.length > 0 && (
                <ul className="space-y-2">
                  {children.slice(0, 8).map((child) => (
                    <li key={child.id}>
                      <Link
                        to={`/category/${child.slug}`}
                        className="group flex items-center gap-1 text-sm text-gray-600 hover:text-orange-600"
                      >
                        {child.name}
                        <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {banner && (
                <Link to={`/category/${category.slug}`} className="mt-4 block overflow-hidden rounded-lg">
                  <img src={banner} alt={category.name} className="h-24 w-full object-cover" />
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
