// Pure nav content -- shared by the desktop sidebar and the mobile
// drawer, so the IA (sellerNav.ts) is rendered once, not defined twice.

import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { SELLER_NAV_SECTIONS } from './sellerNav'
import { cn } from '../../utils'

export default function SellerSidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const location = useLocation()
  const [expandedItem, setExpandedItem] = useState<string | null>(() => {
    const parent = SELLER_NAV_SECTIONS.flatMap((s) => s.items).find(
      (item) => item.children?.some((child) => location.pathname === child.to),
    )
    return parent?.label ?? null
  })

  return (
    <nav aria-label='Seller Center navigation' className='flex-1 space-y-6 overflow-y-auto px-3 py-4'>
      {SELLER_NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          {!collapsed && (
            <p className='mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500'>
              {section.label}
            </p>
          )}
          <div className='space-y-1'>
            {section.items.map((item) => {
              const Icon = item.icon
              const hasChildren = Boolean(item.children?.length)
              const isExpanded = expandedItem === item.label
              const isChildActive = item.children?.some((child) => location.pathname === child.to)

              return (
                <div key={item.label}>
                  <div className='flex items-center'>
                    <NavLink
                      to={item.to}
                      end={item.to === '/seller-center/products'}
                      onClick={() => {
                        if (!hasChildren) onNavigate?.()
                      }}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }: { isActive: boolean }) =>
                        cn(
                          'flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                          isActive || isChildActive
                            ? 'bg-orange-500/15 text-orange-400'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white',
                          collapsed && 'justify-center px-0',
                        )
                      }
                    >
                      <Icon className='h-4.5 w-4.5 shrink-0' />
                      {!collapsed && <span className='truncate'>{item.label}</span>}
                    </NavLink>
                    {hasChildren && !collapsed && (
                      <button
                        type='button'
                        onClick={() => setExpandedItem(isExpanded ? null : item.label)}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.label}`}
                        className='rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white'
                      >
                        <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
                      </button>
                    )}
                  </div>

                  {hasChildren && !collapsed && isExpanded && (
                    <div className='ml-7 mt-1 space-y-1 border-l border-white/10 pl-3'>
                      {item.children!.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          end
                          onClick={onNavigate}
                          className={({ isActive }: { isActive: boolean }) =>
                            cn(
                              'block rounded-lg px-3 py-2 text-sm font-medium transition',
                              isActive
                                ? 'bg-orange-500/15 text-orange-400'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white',
                            )
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
