import { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface AnalyticsTabDef {
  value: string
  label: string
  content: ReactNode
}

interface AnalyticsTabsProps {
  tabs: AnalyticsTabDef[]
  value: string
  onValueChange: (value: string) => void
}

/**
 * Renders each tab's content only when active (shadcn Tabs unmounts
 * inactive TabsContent by default via `forceMount` being off) -- so
 * switching to e.g. Operations doesn't also fire Country Performance's
 * queries. Each tab component owns its own data fetching independently.
 */
export function AnalyticsTabs({ tabs, value, onValueChange }: AnalyticsTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList className='flex-wrap justify-start'>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className='mt-4 space-y-4'>
          {tab.value === value ? tab.content : null}
        </TabsContent>
      ))}
    </Tabs>
  )
}
