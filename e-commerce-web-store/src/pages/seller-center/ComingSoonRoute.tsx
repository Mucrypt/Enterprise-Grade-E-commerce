// One shared route for every Seller Center module that doesn't have a
// real backend yet -- Orders, Inventory, Returns, Shipping, Messages,
// Reviews, Marketing, Payouts, Account health, Academy. Looked up by
// pathname instead of ten nearly-identical page files. See the plan's
// "Real gaps confirmed" section for exactly what's missing on the
// backend for each of these.

import { useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  Boxes,
  ClipboardList,
  GraduationCap,
  Megaphone,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
} from 'lucide-react'
import SellerComingSoon from '../../components/seller-center/SellerComingSoon'
import SellerPageHeader from '../../components/seller-center/SellerPageHeader'

interface ComingSoonConfig {
  icon: LucideIcon
  title: string
  description: string
  links?: { label: string; to: string }[]
}

const CONFIG: Record<string, ComingSoonConfig> = {
  '/seller-center/orders': {
    icon: ClipboardList,
    title: 'Orders',
    description:
      "Order management needs a seller-scoped orders API that doesn't exist yet -- your real orders live in the platform's order system, but there's no way yet to filter them down to just yours here.",
  },
  '/seller-center/inventory': {
    icon: Boxes,
    title: 'Inventory',
    description: 'Multi-location inventory tracking is planned but not built yet. Stock counts for your listings still live on the Products page.',
  },
  '/seller-center/returns': {
    icon: RotateCcw,
    title: 'Returns & refunds',
    description: "There's no returns/refunds table in the platform yet -- refund signal today only exists at the order level, not itemized per return.",
  },
  '/seller-center/shipping': {
    icon: Truck,
    title: 'Shipping',
    description: 'Shipping label generation and carrier integration are planned but not built yet.',
  },
  '/seller-center/messages': {
    icon: MessageSquare,
    title: 'Messages',
    description: "Direct buyer-to-seller messaging doesn't exist in the platform yet. For anything you need from our team in the meantime, use Support.",
    links: [{ label: 'Open Support', to: '/seller-center/support' }],
  },
  '/seller-center/reviews': {
    icon: Star,
    title: 'Reviews',
    description: 'Product reviews exist platform-wide, but there’s no seller-scoped view of reviews on your own products yet.',
  },
  '/seller-center/marketing': {
    icon: Megaphone,
    title: 'Marketing',
    description: 'Self-service promotions and coupons for your own store are planned but not built yet.',
  },
  '/seller-center/payouts': {
    icon: Banknote,
    title: 'Payouts',
    description:
      'Payout-destination management is admin-assisted for now -- your real balances and payout history already live on the Finances page.',
    links: [{ label: 'Open Finances', to: '/seller-center/finances' }],
  },
  '/seller-center/account-health': {
    icon: ShieldCheck,
    title: 'Account health',
    description: 'Account health metrics (dispatch time, defect rate, etc.) need order-level data that isn’t seller-attributed yet.',
  },
  '/seller-center/academy': {
    icon: GraduationCap,
    title: 'Seller Academy',
    description: "Guided lessons aren't built yet. In the meantime, our FAQ and Support cover most seller questions.",
    links: [
      { label: 'Read the FAQ', to: '/faq' },
      { label: 'Contact Support', to: '/seller-center/support' },
    ],
  },
}

export default function ComingSoonRoute() {
  const location = useLocation()
  const config = CONFIG[location.pathname] ?? {
    icon: Boxes,
    title: 'Coming soon',
    description: "This module isn't built yet.",
  }

  return (
    <div>
      <SellerPageHeader title={config.title} />
      <SellerComingSoon
        icon={config.icon}
        title={`${config.title} is coming soon`}
        description={config.description}
        links={config.links}
      />
    </div>
  )
}
