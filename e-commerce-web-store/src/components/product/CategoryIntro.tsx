import type { Category } from '../../types'

interface CategoryIntroProps {
  category: Category
}

// Only renders when the category actually has a real, admin-authored
// description -- categories.description is a genuine CMS field (confirmed
// via the admin CategoryForm), but plenty of categories never had one
// filled in, so this must degrade to nothing rather than fabricate intro
// copy.
export function CategoryIntro({ category }: CategoryIntroProps) {
  if (!category.description) return null

  return (
    <div className="mb-4 max-w-3xl">
      <p className="text-sm leading-relaxed text-gray-600">{category.description}</p>
    </div>
  )
}
