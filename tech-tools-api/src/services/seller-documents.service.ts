// =====================================================
// Seller verification document storage. Every function here treats the
// document as sensitive: the storage key is always server-generated
// (never derived from a client filename), review notes are
// admin-internal only, and the single ownership choke point
// (getSellerDocumentForDownload) is shared by both the seller's own
// download route and the admin download route so there is exactly one
// place that decides "can this caller read this file."
// =====================================================

import { createHash, randomUUID } from 'crypto'
import type { Response } from 'express'
import { query, getClient } from '../database/connection'
import logger from '../utils/logger'
import {
  getSellerDocumentsStorageProvider,
  storePrivateMediaBuffer,
  streamPrivateMedia,
  deletePrivateMedia,
  type StreamedPrivateMedia,
} from './media-storage.service'
import { ALLOWED_DOCUMENT_TYPES } from '../utils/media'
import type { TransitionActor } from './seller-lifecycle.service'

export type SellerDocumentCategory =
  | 'identity_document'
  | 'proof_of_address'
  | 'business_registration'
  | 'tax_document'
  | 'additional_requested'

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

// Shared by both the seller-self and admin download routes -- one place
// that sets every safety header a sensitive-document response needs:
//  - nosniff: stops a browser from re-interpreting the body as HTML/JS
//    if a content-type ever gets mismatched, closing a stored-XSS path.
//  - Cache-Control/Pragma: a verification document must never be cached
//    by a shared/browser cache or CDN in front of this API.
//  - Content-Disposition: attachment, with a category-derived filename
//    only -- never the original client filename, which is never stored.
export function applySecureDocumentDownloadHeaders(
  res: Response,
  info: { contentType: string; category: string; contentLength?: number },
): void {
  const extension = EXTENSION_BY_CONTENT_TYPE[info.contentType] || 'bin'
  res.setHeader('Content-Type', info.contentType)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store, private, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Content-Disposition', `attachment; filename="${info.category}.${extension}"`)
  if (info.contentLength) {
    res.setHeader('Content-Length', String(info.contentLength))
  }
}

export interface DocumentMetadataDTO {
  id: string
  category: string
  uploadStatus: string
  reviewStatus: string
  malwareScanStatus: string
  byteSize: number
  contentType: string
  createdAt: string
  reviewedAt: string | null
}

function toMetadataDTO(row: any): DocumentMetadataDTO {
  return {
    id: row.id,
    category: row.category,
    uploadStatus: row.upload_status,
    reviewStatus: row.review_status,
    malwareScanStatus: row.malware_scan_status,
    byteSize: row.byte_size,
    contentType: row.content_type,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  }
}

// A multipart request's declared MIME type is whatever the client's
// Content-Type header for that field said -- trivially spoofed by
// renaming a file or hand-crafting the request, and never actually
// inspected by multer's fileFilter (which only reads that same
// declared header). This checks the file's real magic bytes against the
// small, fixed set this endpoint accepts, so a declared "image/jpeg"
// that is actually, say, an HTML file (a stored-XSS/polyglot attempt) is
// rejected before it's ever written to storage.
function detectFileSignature(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf'
  }
  return null
}

const SIGNATURE_EQUIVALENT_CONTENT_TYPES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
}

export async function uploadSellerDocument(input: {
  sellerProfileId: string
  userId: string
  category: SellerDocumentCategory
  fileBuffer: Buffer
  contentType: string
  actor: TransitionActor
}): Promise<DocumentMetadataDTO> {
  if (!ALLOWED_DOCUMENT_TYPES.includes(input.contentType)) {
    throw new Error(`Unsupported document content type: ${input.contentType}`)
  }
  if (!input.fileBuffer || input.fileBuffer.length === 0) {
    throw new Error('Empty file')
  }

  const declaredType = SIGNATURE_EQUIVALENT_CONTENT_TYPES[input.contentType] || input.contentType
  const actualType = detectFileSignature(input.fileBuffer)
  if (actualType !== declaredType) {
    throw new Error(
      `File content does not match its declared type (declared ${input.contentType}, ` +
        `detected ${actualType || 'unrecognized/unknown'})`,
    )
  }

  const extension = EXTENSION_BY_CONTENT_TYPE[input.contentType] || 'bin'
  // Server-generated key only -- never derived from the client's
  // filename, which is never read or persisted anywhere in this flow.
  const storageKey = `seller-documents/${input.sellerProfileId}/${randomUUID()}.${extension}`
  const checksum = createHash('sha256').update(input.fileBuffer).digest('hex')
  const provider = getSellerDocumentsStorageProvider()

  const stored = await storePrivateMediaBuffer({
    key: storageKey,
    body: input.fileBuffer,
    contentType: input.contentType,
  })

  const client = await getClient()
  try {
    await client.query('BEGIN')

    await client.query(
      `UPDATE seller_verification_documents
       SET is_current = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE seller_profile_id = $1 AND category = $2 AND is_current = TRUE`,
      [input.sellerProfileId, input.category],
    )

    const priorResult = await client.query(
      `SELECT id FROM seller_verification_documents
       WHERE seller_profile_id = $1 AND category = $2
       ORDER BY created_at DESC LIMIT 1`,
      [input.sellerProfileId, input.category],
    )
    const priorId = priorResult.rows[0]?.id || null

    const inserted = await client.query(
      `INSERT INTO seller_verification_documents (
        seller_profile_id, user_id, category, storage_provider, storage_key,
        content_type, byte_size, checksum_sha256, upload_status, is_current, replaces_document_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded', TRUE, $9)
      RETURNING *`,
      [
        input.sellerProfileId,
        input.userId,
        input.category,
        stored.provider,
        stored.key,
        input.contentType,
        input.fileBuffer.length,
        checksum,
        priorId,
      ],
    )

    await client.query(
      `INSERT INTO seller_audit_log
        (seller_profile_id, user_id, actor_id, action, previous_state, new_state, details)
       VALUES ($1, $2, $3, 'seller_document_uploaded', $4::jsonb, $5::jsonb, $6::jsonb)`,
      [
        input.sellerProfileId,
        input.userId,
        input.actor.actorId,
        priorId ? JSON.stringify({ documentId: priorId }) : null,
        JSON.stringify({ documentId: inserted.rows[0].id, category: input.category }),
        // Never log the checksum/storage key/content -- category and
        // byte size only, nothing that identifies the document content.
        JSON.stringify({ category: input.category, byteSize: input.fileBuffer.length }),
      ],
    )

    await client.query('COMMIT')

    scanDocumentForMalware(inserted.rows[0].id).catch((error) =>
      logger.warn('Document malware scan failed', error),
    )

    return toMetadataDTO(inserted.rows[0])
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

// Explicit no-op extension seam for this phase -- no malware scanner is
// integrated. A future scanner replaces only this function body; every
// caller and the schema (malware_scan_status) are already in place.
export async function scanDocumentForMalware(_documentId: string): Promise<void> {
  return
}

export async function listCurrentSellerDocuments(sellerProfileId: string): Promise<DocumentMetadataDTO[]> {
  // Explicit safe-column SELECT -- storage_key/storage_provider/
  // checksum are never returned to any caller of this function.
  const result = await query(
    `SELECT id, category, upload_status, review_status, malware_scan_status, byte_size, content_type,
            created_at, reviewed_at
     FROM seller_verification_documents
     WHERE seller_profile_id = $1 AND is_current = TRUE
     ORDER BY category`,
    [sellerProfileId],
  )
  return result.rows.map(toMetadataDTO)
}

export async function getSellerDocumentForDownload(
  documentId: string,
  requester: { userId?: string; isAdmin: boolean },
): Promise<{ stream: StreamedPrivateMedia; contentType: string; category: string } | null> {
  const result = await query(
    `SELECT * FROM seller_verification_documents WHERE id = $1 AND is_current = TRUE LIMIT 1`,
    [documentId],
  )
  const doc = result.rows[0]
  if (!doc) return null

  // The single ownership choke point: admins skip the owner check,
  // everyone else must own the document. Returning null (not throwing)
  // lets both callers respond 404 -- indistinguishable from "no such
  // document" to avoid confirming a document's existence to a caller
  // who doesn't own it (anti-enumeration).
  if (!requester.isAdmin && doc.user_id !== requester.userId) {
    return null
  }

  const stream = await streamPrivateMedia(doc.storage_provider, doc.storage_key)
  return { stream, contentType: doc.content_type, category: doc.category }
}

export async function deleteSellerDocument(
  documentId: string,
  requester: { userId?: string; isAdmin: boolean },
  actor: TransitionActor,
): Promise<boolean> {
  const result = await query(
    `SELECT * FROM seller_verification_documents WHERE id = $1 AND is_current = TRUE LIMIT 1`,
    [documentId],
  )
  const doc = result.rows[0]
  if (!doc) return false
  if (!requester.isAdmin && doc.user_id !== requester.userId) return false

  // Soft-delete only -- never a hard row/file delete, preserving audit
  // and review history for anything already looked at by an admin.
  await query(
    `UPDATE seller_verification_documents SET is_current = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [documentId],
  )

  await query(
    `INSERT INTO seller_audit_log (seller_profile_id, user_id, actor_id, action, details)
     VALUES ($1, $2, $3, 'seller_document_removed', $4::jsonb)`,
    [doc.seller_profile_id, doc.user_id, actor.actorId, JSON.stringify({ documentId, category: doc.category })],
  ).catch((error) => logger.warn('Failed to append seller audit log', error))

  return true
}

export async function reviewSellerDocument(params: {
  documentId: string
  reviewStatus: 'accepted' | 'rejected'
  reviewNotes?: string
  actor: TransitionActor
}): Promise<DocumentMetadataDTO | null> {
  const result = await query(
    `UPDATE seller_verification_documents
     SET review_status = $1, review_notes = $2, reviewed_by_admin_id = $3, reviewed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 AND is_current = TRUE
     RETURNING *`,
    [params.reviewStatus, params.reviewNotes || null, params.actor.actorId, params.documentId],
  )
  const doc = result.rows[0]
  if (!doc) return null

  await query(
    `INSERT INTO seller_audit_log (seller_profile_id, user_id, actor_id, action, new_state, details)
     VALUES ($1, $2, $3, 'seller_document_reviewed', $4::jsonb, $5::jsonb)`,
    [
      doc.seller_profile_id,
      doc.user_id,
      params.actor.actorId,
      JSON.stringify({ reviewStatus: params.reviewStatus }),
      JSON.stringify({ documentId: doc.id, category: doc.category }),
    ],
  ).catch((error) => logger.warn('Failed to append seller audit log', error))

  return toMetadataDTO(doc)
}
