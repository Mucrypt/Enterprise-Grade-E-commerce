// Broadcast announcements from admin -- one-to-many, in-app only (no
// bulk email yet). Real per-seller read tracking: unread ones are
// visually distinguished and get marked read the moment a seller expands
// one, never assumed read just because the list loaded.

import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { sellerAnnouncementsApi, type SellerAnnouncement } from '../../api'

export default function SellerAnnouncementsBanner() {
  const [announcements, setAnnouncements] = useState<SellerAnnouncement[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    sellerAnnouncementsApi
      .list()
      .then((items) => {
        if (!cancelled) setAnnouncements(items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (announcements.length === 0) return null

  const handleExpand = (announcement: SellerAnnouncement) => {
    setExpandedId((current) => (current === announcement.id ? null : announcement.id))
    if (!announcement.isRead) {
      setAnnouncements((current) =>
        current.map((item) => (item.id === announcement.id ? { ...item, isRead: true } : item)),
      )
      sellerAnnouncementsApi.markRead(announcement.id).catch(() => {})
    }
  }

  return (
    <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
      <h2 className='flex items-center gap-2 text-lg font-bold text-slate-900'>
        <Megaphone className='h-5 w-5 text-orange-600' /> Announcements
      </h2>
      <div className='mt-4 space-y-2'>
        {announcements.map((announcement) => (
          <button
            key={announcement.id}
            type='button'
            onClick={() => handleExpand(announcement)}
            className='block w-full rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100'
          >
            <div className='flex items-center gap-2'>
              {!announcement.isRead && <span className='h-2 w-2 shrink-0 rounded-full bg-orange-500' />}
              <p className={`text-sm ${announcement.isRead ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>
                {announcement.subject}
              </p>
              <span className='ml-auto text-xs text-gray-400'>
                {new Date(announcement.created_at).toLocaleDateString()}
              </span>
            </div>
            {expandedId === announcement.id && (
              <p className='mt-2 whitespace-pre-wrap text-sm text-gray-600'>{announcement.body}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
