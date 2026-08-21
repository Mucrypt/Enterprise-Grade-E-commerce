/**
 * SOURCING-1 -- packages sourcing-extension/ (a sibling directory of this
 * monorepo, not inside tech-tools-api itself) into a zip on demand, so the
 * founder can grab the current extension from the dashboard on any
 * computer or browser without hunting for a local file path -- no Chrome
 * Web Store listing required (see cors.config.ts's sibling comment for
 * the extension's other production-specific quirks).
 *
 * SOURCING_EXTENSION_DIR defaults to "../sourcing-extension" relative to
 * the running process's cwd (tech-tools-api/, whether via `npm start` or
 * however the deploy process launches it). Override with the env var if
 * this process ever runs from a different working directory or the
 * monorepo layout changes.
 */
import fs from 'fs'
import path from 'path'
import archiver from 'archiver'
import { Response } from 'express'
import logger from '../../utils/logger'

const SOURCING_EXTENSION_DIR = process.env.SOURCING_EXTENSION_DIR || path.resolve(process.cwd(), '..', 'sourcing-extension')

export function extensionDirectoryExists(): boolean {
  try {
    return fs.statSync(SOURCING_EXTENSION_DIR).isDirectory()
  } catch {
    return false
  }
}

export function streamExtensionZip(res: Response): void {
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', 'attachment; filename="techtools-sourcing-extension.zip"')

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('error', (error) => {
    logger.error('Failed to build sourcing extension zip:', error)
    res.end()
  })
  archive.pipe(res)
  archive.directory(SOURCING_EXTENSION_DIR, 'sourcing-extension')
  archive.finalize()
}
