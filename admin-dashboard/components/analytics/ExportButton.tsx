import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/**
 * Client-side CSV generation from data ALREADY fetched through a scoped,
 * permission-checked endpoint -- deliberately not a separate backend CSV
 * route. The data on screen is already exactly what the caller is allowed
 * to see (see every analytics-v2.controller.ts endpoint's scope
 * resolution); reformatting it as CSV in the browser can't expose
 * anything beyond that, so this needs no permission logic of its own.
 */
export function rowsToCsv<T extends object>(rows: T[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) {
    const rowRecord = row as Record<string, unknown>
    lines.push(headers.map((h) => toCsvValue(rowRecord[h])).join(','))
  }
  return lines.join('\n')
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

interface ExportButtonProps<T extends object> {
  filename: string
  rows: T[]
  label?: string
}

export function ExportButton<T extends object>({ filename, rows, label = 'Export CSV' }: ExportButtonProps<T>) {
  return (
    <Button
      variant='outline'
      size='sm'
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, rowsToCsv(rows))}
    >
      <Download className='mr-2 h-4 w-4' />
      {label}
    </Button>
  )
}
