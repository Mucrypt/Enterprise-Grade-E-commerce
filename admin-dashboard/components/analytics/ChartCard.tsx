import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataQualityNotice } from './DataQualityNotice'

interface ChartCardProps {
  title: string
  action?: ReactNode
  dataQualityNote?: string
  children: ReactNode
  className?: string
}

/** Standard chart/table container -- every tab wraps its charts in this so spacing/typography stay consistent instead of each tab inventing its own card chrome. */
export function ChartCard({ title, action, dataQualityNote, children, className }: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-base'>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        {children}
        {dataQualityNote && <DataQualityNotice message={dataQualityNote} className='mt-3' />}
      </CardContent>
    </Card>
  )
}
