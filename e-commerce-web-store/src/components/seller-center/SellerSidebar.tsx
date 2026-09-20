// Desktop persistent sidebar. Collapse state is persisted via
// sellerCenterUiStore (same zustand/persist pattern authStore already
// uses) so the seller's preference survives a reload.

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useSellerCenterUiStore } from '../../stores/sellerCenterUiStore'
import SellerSidebarNav from './SellerSidebarNav'

export default function SellerSidebar() {
  const { sidebarCollapsed, toggleSidebar } = useSellerCenterUiStore()

  return (
    <aside
      className={`hidden shrink-0 flex-col bg-slate-950 transition-all duration-200 lg:flex ${
        sidebarCollapsed ? 'w-[76px]' : 'w-64'
      }`}
    >
      <SellerSidebarNav collapsed={sidebarCollapsed} />
      <div className='border-t border-white/10 p-3'>
        <button
          type='button'
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className='flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white'
        >
          {sidebarCollapsed ? <PanelLeftOpen className='h-4.5 w-4.5' /> : <PanelLeftClose className='h-4.5 w-4.5' />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
