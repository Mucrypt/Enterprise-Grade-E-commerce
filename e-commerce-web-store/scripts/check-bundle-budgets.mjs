import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const distDir = path.resolve(process.cwd(), 'dist')
const assetsDir = path.resolve(distDir, 'assets')
const reportPath = path.resolve(distDir, 'bundle-budget-report.md')

if (!fs.existsSync(assetsDir)) {
  console.error('Bundle budget check failed: dist/assets not found. Run build first.')
  process.exit(1)
}

const allAssetFiles = fs
  .readdirSync(assetsDir)
  .filter((file) => file.endsWith('.js'))
  .sort((a, b) => a.localeCompare(b))

const kb = (bytes) => Number((bytes / 1024).toFixed(2))

const getSizes = (fileName) => {
  const absolutePath = path.resolve(assetsDir, fileName)
  const content = fs.readFileSync(absolutePath)
  const gzipBytes = zlib.gzipSync(content, { level: 9 }).length

  return {
    fileName,
    rawBytes: content.length,
    gzipBytes,
    rawKb: kb(content.length),
    gzipKb: kb(gzipBytes),
  }
}

const findByPrefix = (prefix) =>
  allAssetFiles.find((fileName) => fileName.startsWith(prefix))

const budgets = [
  {
    label: 'Entry index',
    prefix: 'entry-index-',
    maxRawKb: 130,
    maxGzipKb: 40,
    required: true,
  },
  {
    label: 'Vendor react',
    prefix: 'chunk-vendor-react-',
    maxRawKb: 210,
    maxGzipKb: 70,
    required: true,
  },
  {
    label: 'Vendor router',
    prefix: 'chunk-vendor-router-',
    maxRawKb: 45,
    maxGzipKb: 16,
    required: true,
  },
  {
    label: 'Vendor query',
    prefix: 'chunk-vendor-query-',
    maxRawKb: 40,
    maxGzipKb: 12,
    required: true,
  },
  {
    label: 'Vendor payments',
    prefix: 'chunk-vendor-network-payments-',
    maxRawKb: 60,
    maxGzipKb: 24,
    required: true,
  },
  {
    label: 'Vendor i18n',
    prefix: 'chunk-vendor-i18n-',
    maxRawKb: 75,
    maxGzipKb: 26,
    required: true,
  },
  {
    label: 'Vendor UI',
    prefix: 'chunk-vendor-ui-',
    maxRawKb: 85,
    maxGzipKb: 28,
    required: true,
  },
  {
    label: 'Checkout route',
    prefix: 'chunk-CheckoutPage-',
    maxRawKb: 35,
    maxGzipKb: 10,
    required: true,
  },
]

const results = budgets.map((budget) => {
  const matchedFile = findByPrefix(budget.prefix)

  if (!matchedFile) {
    return {
      ...budget,
      status: budget.required ? 'missing' : 'skipped',
    }
  }

  const sizes = getSizes(matchedFile)
  const overRaw = sizes.rawKb > budget.maxRawKb
  const overGzip = sizes.gzipKb > budget.maxGzipKb

  return {
    ...budget,
    ...sizes,
    status: overRaw || overGzip ? 'fail' : 'pass',
    overRaw,
    overGzip,
  }
})

const failing = results.filter(
  (result) => result.status === 'fail' || result.status === 'missing',
)

const lines = [
  '# Web Store Bundle Budget Report',
  '',
  '| Chunk | File | Raw KB | Budget Raw KB | Gzip KB | Budget Gzip KB | Status |',
  '|---|---|---:|---:|---:|---:|---|',
]

for (const result of results) {
  if (result.status === 'missing') {
    lines.push(
      `| ${result.label} | not found | - | ${result.maxRawKb} | - | ${result.maxGzipKb} | FAIL (missing) |`,
    )
    continue
  }

  const statusLabel = result.status === 'pass' ? 'PASS' : 'FAIL'
  lines.push(
    `| ${result.label} | ${result.fileName} | ${result.rawKb} | ${result.maxRawKb} | ${result.gzipKb} | ${result.maxGzipKb} | ${statusLabel} |`,
  )
}

if (failing.length === 0) {
  lines.push('', 'All configured chunk budgets passed.')
} else {
  lines.push('', `Failed checks: ${failing.length}`)
}

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8')

console.log(lines.join('\n'))
console.log(`\nReport written to ${reportPath}`)

if (failing.length > 0) {
  process.exit(1)
}
