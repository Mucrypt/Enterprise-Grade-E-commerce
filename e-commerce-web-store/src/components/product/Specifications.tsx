import type { Product, ProductSpecification } from '../../types'

interface SpecificationsProps {
  product: Product
}

function groupBySpecGroup(specs: ProductSpecification[]): Map<string, ProductSpecification[]> {
  const groups = new Map<string, ProductSpecification[]>()
  for (const spec of [...specs].sort((a, b) => a.display_order - b.display_order)) {
    const key = spec.spec_group || 'General'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(spec)
  }
  return groups
}

export function Specifications({ product }: SpecificationsProps) {
  const specs = product.specifications || []
  const groups = groupBySpecGroup(specs)

  // Brand/Category/SKU/Weight are always real product fields -- kept as a
  // baseline row set even when no admin-entered specifications exist yet,
  // so the tab is never fully empty for a product that simply hasn't had
  // its spec sheet filled in.
  const baselineRows: [string, string][] = [
    ['Brand', product.brand_name || '—'],
    ['Category', product.category_name || '—'],
    ['SKU', product.sku],
  ]
  if (product.weight) {
    baselineRows.push(['Weight', `${product.weight} ${product.weight_unit || ''}`.trim()])
  }

  return (
    <div className='space-y-6'>
      <table className='w-full'>
        <tbody className='divide-y'>
          {baselineRows.map(([label, value]) => (
            <tr key={label}>
              <td className='w-1/3 py-3 text-gray-500'>{label}</td>
              <td className='py-3 font-medium'>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {Array.from(groups.entries()).map(([group, groupSpecs]) => (
        <div key={group}>
          <h3 className='mb-2 text-sm font-semibold text-gray-900'>{group}</h3>
          <table className='w-full'>
            <tbody className='divide-y'>
              {groupSpecs.map((spec) => (
                <tr key={spec.id}>
                  <td className='w-1/3 py-3 text-gray-500'>{spec.spec_key}</td>
                  <td className='py-3 font-medium'>{spec.spec_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
