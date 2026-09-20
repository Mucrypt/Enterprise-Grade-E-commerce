import { describe, it, expect, beforeEach } from 'vitest'
import { useSellerCenterUiStore } from './sellerCenterUiStore'

describe('sellerCenterUiStore -- sidebar-collapsed persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    useSellerCenterUiStore.setState({ sidebarCollapsed: false })
  })

  it('toggles the collapsed flag', () => {
    useSellerCenterUiStore.getState().toggleSidebar()
    expect(useSellerCenterUiStore.getState().sidebarCollapsed).toBe(true)

    useSellerCenterUiStore.getState().toggleSidebar()
    expect(useSellerCenterUiStore.getState().sidebarCollapsed).toBe(false)
  })

  it('setSidebarCollapsed sets the flag directly regardless of current state', () => {
    useSellerCenterUiStore.getState().setSidebarCollapsed(true)
    expect(useSellerCenterUiStore.getState().sidebarCollapsed).toBe(true)

    useSellerCenterUiStore.getState().setSidebarCollapsed(true)
    expect(useSellerCenterUiStore.getState().sidebarCollapsed).toBe(true)
  })

  it('persists the collapsed preference under its documented storage key, surviving a simulated reload', () => {
    useSellerCenterUiStore.getState().setSidebarCollapsed(true)

    const raw = localStorage.getItem('techtools-seller-center-ui')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).state.sidebarCollapsed).toBe(true)
  })
})
