// Walks a seller through what a tier that requires ID verification
// actually needs before they hit submit, instead of letting them fire
// off a bare text-note request that can never be approved -- the
// backend's fail-closed rule (seller-lifecycle.service.ts's
// approveVerification) refuses any tier with requires_id_verification
// unless a document is on file that is BOTH admin-accepted AND
// malware-scanned clean. No scanner is connected yet, so this can't make
// approval succeed any faster -- it exists so the seller actually has a
// document on file for an admin to review by hand in the meantime,
// instead of submitting a request with nothing behind it at all.

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, Upload, X } from 'lucide-react'
import { sellerDocumentsApi, type SellerDocument } from '../../api'
import { formatTier } from '../../utils/sellerTier'

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_BYTES = 10 * 1024 * 1024 // matches the backend's MAX_FILE_SIZE default

interface RequestVerificationModalProps {
  tier: string
  onClose: () => void
  onConfirm: () => Promise<void> | void
  busy: boolean
}

function statusDescription(document: SellerDocument): { label: string; tone: 'pending' | 'good' | 'bad' } {
  if (document.reviewStatus === 'rejected') {
    return { label: 'Rejected -- please upload a replacement.', tone: 'bad' }
  }
  if (document.reviewStatus === 'accepted' && document.malwareScanStatus === 'clean') {
    return { label: 'Accepted and verified clean.', tone: 'good' }
  }
  if (document.reviewStatus === 'accepted') {
    return {
      label:
        'Accepted by an admin, but automated malware scanning is not connected yet -- your request will stay on file and complete automatically once scanning is available.',
      tone: 'pending',
    }
  }
  return { label: 'Uploaded -- waiting for admin review.', tone: 'pending' }
}

export default function RequestVerificationModal({
  tier,
  onClose,
  onConfirm,
  busy,
}: RequestVerificationModalProps) {
  const [loading, setLoading] = useState(true)
  const [currentDocument, setCurrentDocument] = useState<SellerDocument | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    sellerDocumentsApi
      .getMine()
      .then((documents) => {
        if (cancelled) return
        const identity = documents.find((doc) => doc.category === 'identity_document')
        setCurrentDocument(identity || null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploadError('')

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError('Use a JPEG, PNG, WEBP, or PDF file.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError('File is too large -- the limit is 10MB.')
      return
    }

    setUploading(true)
    try {
      const document = await sellerDocumentsApi.upload(file, 'identity_document')
      setCurrentDocument(document)
    } catch (error: any) {
      setUploadError(
        error?.response?.data?.error || 'Could not upload this document right now. Please try again.',
      )
    } finally {
      setUploading(false)
    }
  }

  const canSubmit = Boolean(currentDocument) && !uploading && !busy

  return (
    <div
      className='fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4'
      role='dialog'
      aria-modal='true'
      aria-label={`Verify identity for ${formatTier(tier)}`}
      onClick={onClose}
    >
      <div
        className='relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl'
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type='button'
          onClick={onClose}
          aria-label='Close'
          className='absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600'
        >
          <X className='h-5 w-5' />
        </button>

        <div className='flex items-center gap-2'>
          <ShieldCheck className='h-5 w-5 text-orange-600' />
          <h2 className='text-lg font-bold text-slate-900'>Verify your identity</h2>
        </div>
        <p className='mt-2 text-sm text-gray-500'>
          {formatTier(tier)} requires a government-issued ID or passport on file before an admin can
          review your request. Upload it below, then submit.
        </p>

        <div className='mt-5 rounded-2xl border border-gray-100 bg-slate-50 p-4'>
          {loading ? (
            <div className='flex items-center gap-2 text-sm text-gray-500'>
              <Loader2 className='h-4 w-4 animate-spin' /> Checking for an existing document...
            </div>
          ) : currentDocument ? (
            (() => {
              const status = statusDescription(currentDocument)
              return (
                <div>
                  <div className='flex items-center gap-2'>
                    {status.tone === 'good' ? (
                      <CheckCircle2 className='h-4 w-4 shrink-0 text-emerald-600' />
                    ) : status.tone === 'bad' ? (
                      <AlertCircle className='h-4 w-4 shrink-0 text-red-600' />
                    ) : (
                      <Loader2 className='h-4 w-4 shrink-0 text-amber-600' />
                    )}
                    <p className='text-sm font-semibold text-slate-900'>Identity document on file</p>
                  </div>
                  <p className='mt-1 text-xs text-gray-500'>{status.label}</p>
                  {status.tone === 'bad' && (
                    <label className='mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-gray-50'>
                      <Upload className='h-3.5 w-3.5' />
                      {uploading ? 'Uploading...' : 'Upload a replacement'}
                      <input
                        type='file'
                        accept={ACCEPTED_TYPES.join(',')}
                        className='hidden'
                        disabled={uploading}
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>
              )
            })()
          ) : (
            <div>
              <label className='flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 py-8 text-center transition hover:border-orange-300'>
                <Upload className='h-6 w-6 text-gray-400' />
                <span className='text-sm font-semibold text-slate-900'>
                  {uploading ? 'Uploading...' : 'Click to upload your ID or passport'}
                </span>
                <span className='text-xs text-gray-400'>JPEG, PNG, WEBP, or PDF -- up to 10MB</span>
                <input
                  type='file'
                  accept={ACCEPTED_TYPES.join(',')}
                  className='hidden'
                  disabled={uploading}
                  onChange={handleFileChange}
                />
              </label>
              {uploading && (
                <div className='mt-3 flex items-center justify-center gap-2 text-sm text-gray-500'>
                  <Loader2 className='h-4 w-4 animate-spin' /> Uploading...
                </div>
              )}
            </div>
          )}
          {uploadError && <p className='mt-3 text-xs font-medium text-red-600'>{uploadError}</p>}
        </div>

        <p className='mt-3 text-xs text-gray-400'>
          Stored privately -- only you and TechTools staff reviewing your application can access it.
        </p>

        <div className='mt-6 flex justify-end gap-3'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={() => onConfirm()}
            disabled={!canSubmit}
            className='rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {busy ? 'Submitting...' : 'Submit request'}
          </button>
        </div>
      </div>
    </div>
  )
}
