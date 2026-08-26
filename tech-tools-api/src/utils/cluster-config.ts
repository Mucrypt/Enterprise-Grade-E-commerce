import os from 'os'

/**
 * Number of Node worker processes to run. One per CPU core by default in
 * production (override with WEB_CONCURRENCY) -- outside production this is
 * always 1, so `npm run dev`'s nodemon/ts-node loop stays a single,
 * easy-to-debug process exactly as before. Shared between index.ts (how
 * many workers to fork) and database.ts (how to size each worker's own
 * connection pool so the total across all workers stays under Postgres's
 * max_connections).
 */
export function resolveWorkerCount(): number {
  if (process.env.NODE_ENV !== 'production') return 1
  const configured = parseInt(process.env.WEB_CONCURRENCY || '', 10)
  if (Number.isFinite(configured) && configured > 0) return configured
  return os.cpus().length || 1
}
