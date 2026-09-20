import { useState } from 'react'
import { BadgeCheck, Loader2, UserCircle2 } from 'lucide-react'
import { creatorApi } from '../../api'
import MessageBanner from './MessageBanner'
import { useCreatorDashboardContext } from './context'

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

export default function SettingsTab() {
  const { creatorProfile, setCreatorProfile, fallbackName } = useCreatorDashboardContext()

  const [form, setForm] = useState({
    handle: creatorProfile?.handle || '',
    displayName: creatorProfile?.display_name || fallbackName,
    bio: creatorProfile?.bio || '',
    websiteUrl: creatorProfile?.website_url || '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSave = async () => {
    setError('')
    setSuccess('')
    setIsSaving(true)
    try {
      const saved = await creatorApi.upsertMyProfile({
        handle: toSlug(form.handle),
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        websiteUrl: form.websiteUrl.trim(),
        isPublic: true,
      })
      setCreatorProfile(saved)
      setSuccess('Creator profile saved. Your public creator identity is ready.')
    } catch (saveError: any) {
      setError(saveError?.response?.data?.error || 'Could not save creator profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
      <MessageBanner error={error} success={success} />

      <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
        <UserCircle2 className='h-5 w-5 text-blue-600' /> Creator identity
      </h2>
      <p className='mt-1 text-sm text-gray-500'>Configure how buyers see your creator storefront.</p>

      <div className='mt-5 grid gap-4 md:grid-cols-2'>
        <input
          value={form.displayName}
          onChange={(e) => setForm((current) => ({ ...current, displayName: e.target.value }))}
          placeholder='Display name'
          className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
        />
        <input
          value={form.handle}
          onChange={(e) => setForm((current) => ({ ...current, handle: e.target.value }))}
          placeholder='Handle (e.g. jane-doe)'
          className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
        />
        <input
          value={form.websiteUrl}
          onChange={(e) => setForm((current) => ({ ...current, websiteUrl: e.target.value }))}
          placeholder='Website URL (optional)'
          className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 md:col-span-2'
        />
        <textarea
          value={form.bio}
          onChange={(e) => setForm((current) => ({ ...current, bio: e.target.value }))}
          placeholder='Creator bio'
          rows={4}
          className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 md:col-span-2'
        />
      </div>

      <button
        type='button'
        onClick={handleSave}
        disabled={isSaving}
        className='mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
      >
        {isSaving ? <Loader2 className='h-4 w-4 animate-spin' /> : <BadgeCheck className='h-4 w-4' />}
        {isSaving ? 'Saving...' : 'Save creator profile'}
      </button>
    </div>
  )
}
