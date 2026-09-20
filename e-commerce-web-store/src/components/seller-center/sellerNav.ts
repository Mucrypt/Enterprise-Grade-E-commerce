// Single source of truth for the Seller Center's information
// architecture -- shared by the sidebar, the mobile drawer, and the
// command palette so there's exactly one place that defines "what
// destinations exist," never three copies that can drift apart.

import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  Boxes,
  ClipboardList,
  Clapperboard,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  Package,
  RotateCcw,
  Settings,
  ShieldCheck,
  Star,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'

export interface SellerNavItem {
  label: string
  to: string
  icon: LucideIcon
  children?: { label: string; to: string }[]
}

export interface SellerNavSection {
  label: string
  items: SellerNavItem[]
}

export const SELLER_NAV_SECTIONS: SellerNavSection[] = [
  {
    label: 'Main',
    items: [
      { label: 'Overview', to: '/seller-center/overview', icon: LayoutDashboard },
      {
        label: 'Products',
        to: '/seller-center/products',
        icon: Package,
        children: [
          { label: 'Store products', to: '/seller-center/products' },
          { label: 'Books', to: '/seller-center/products/books' },
        ],
      },
      { label: 'Orders', to: '/seller-center/orders', icon: ClipboardList },
      { label: 'Inventory', to: '/seller-center/inventory', icon: Boxes },
      { label: 'Returns & refunds', to: '/seller-center/returns', icon: RotateCcw },
      { label: 'Shipping', to: '/seller-center/shipping', icon: Truck },
    ],
  },
  {
    label: 'Engage',
    items: [
      { label: 'Messages', to: '/seller-center/messages', icon: MessageSquare },
      { label: 'Reviews', to: '/seller-center/reviews', icon: Star },
      { label: 'Marketing', to: '/seller-center/marketing', icon: Megaphone },
      { label: 'Content', to: '/seller-center/content', icon: Clapperboard },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', to: '/seller-center/analytics', icon: TrendingUp },
      { label: 'Finances', to: '/seller-center/finances', icon: Wallet },
      { label: 'Payouts', to: '/seller-center/payouts', icon: Banknote },
      { label: 'Account health', to: '/seller-center/account-health', icon: ShieldCheck },
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'Seller Academy', to: '/seller-center/academy', icon: GraduationCap },
      { label: 'Support', to: '/seller-center/support', icon: LifeBuoy },
      { label: 'Settings', to: '/seller-center/settings', icon: Settings },
    ],
  },
]

// Flat list, used by the command palette -- every real destination plus
// their nested children, no duplicated definitions.
export const SELLER_NAV_FLAT: { label: string; to: string; icon: LucideIcon }[] =
  SELLER_NAV_SECTIONS.flatMap((section) =>
    section.items.flatMap((item) => [
      { label: item.label, to: item.to, icon: item.icon },
      ...(item.children?.map((child) => ({ label: child.label, to: child.to, icon: item.icon })) || []),
    ]),
  )
