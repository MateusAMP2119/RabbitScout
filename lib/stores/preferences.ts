import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TableDensity = 'comfortable' | 'compact'

interface PreferencesState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  density: TableDensity
  setDensity: (d: TableDensity) => void
  vhost: string | null // null = all vhosts
  setVhost: (v: string | null) => void
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      density: 'comfortable',
      setDensity: (density) => set({ density }),
      vhost: null,
      setVhost: (vhost) => set({ vhost }),
    }),
    { name: 'rabbitscout-preferences' },
  ),
)
