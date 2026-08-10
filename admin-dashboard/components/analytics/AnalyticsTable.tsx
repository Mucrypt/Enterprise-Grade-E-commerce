import { ReactNode } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { Inbox } from 'lucide-react'

export interface AnalyticsTableColumn<T> {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  render: (row: T) => ReactNode
}

interface AnalyticsTableProps<T> {
  columns: AnalyticsTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
}

/**
 * Shared table shell for every data-dense list in Analytics 2.0 (Sales
 * breakdowns, Product Intelligence, Search & Demand, Acquisition,
 * Operations, Country Performance) -- gives every one of them the same
 * empty state and cell alignment conventions instead of six ad hoc
 * `<table>` markups.
 */
export function AnalyticsTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle = 'No data for this period',
  emptyDescription = 'Try widening the date range or clearing filters.',
  onRowClick,
}: AnalyticsTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className='overflow-x-auto'>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : undefined}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : undefined}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : undefined}
                >
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
