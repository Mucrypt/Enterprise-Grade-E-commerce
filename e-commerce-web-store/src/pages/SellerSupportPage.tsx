// A seller's own support tickets -- a real threaded conversation with
// admin staff (multiple messages each way over time), not a one-shot
// contact form. Reachable by any seller with a profile at all, even
// unverified/pending -- that's exactly when support matters most.

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, MessageSquarePlus, Send } from 'lucide-react'
import { sellerSupportApi, type SupportTicket, type SupportMessage, type SupportTicketCategory } from '../api'
import SellerPageHeader from '../components/seller-center/SellerPageHeader'

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const STATUS_CLASS: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-gray-100 text-gray-600',
}

const CATEGORY_OPTIONS: { value: SupportTicketCategory; label: string }[] = [
  { value: 'payouts', label: 'Payouts' },
  { value: 'verification', label: 'Verification' },
  { value: 'product_listing', label: 'Product listing' },
  { value: 'technical', label: 'Technical' },
  { value: 'other', label: 'Other' },
]

function NewTicketForm({ onCreated }: { onCreated: (ticket: SupportTicket) => void }) {
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<SupportTicketCategory>('other')
  const [body, setBody] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!subject.trim()) return setError('Give your ticket a subject.')
    if (!body.trim()) return setError('Describe what you need help with.')

    setIsSaving(true)
    try {
      const result = await sellerSupportApi.create({ subject, category, body })
      setSubject('')
      setBody('')
      onCreated(result.ticket)
    } catch (createError: any) {
      setError(createError?.response?.data?.message || 'Could not create the ticket right now.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
      <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
        <MessageSquarePlus className='h-5 w-5 text-orange-600' /> New ticket
      </h2>

      <div className='mt-5 grid gap-3 md:grid-cols-2'>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder='Subject'
          className='w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
          className='w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder='What do you need help with?'
        className='mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
      />

      {error && <p className='mt-3 text-sm font-medium text-red-600'>{error}</p>}

      <button
        type='button'
        onClick={handleSubmit}
        disabled={isSaving}
        className='mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60'
      >
        {isSaving ? (
          <>
            <Loader2 className='h-4 w-4 animate-spin' /> Submitting...
          </>
        ) : (
          'Submit ticket'
        )}
      </button>
    </div>
  )
}

function TicketThread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [isSending, setIsSending] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await sellerSupportApi.getById(ticketId)
      setTicket(result.ticket)
      setMessages(result.messages)
    } catch {
      // Soft failure -- the rest of the page still works.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const handleReply = async () => {
    if (!reply.trim()) return
    setIsSending(true)
    try {
      await sellerSupportApi.reply(ticketId, reply)
      setReply('')
      await load()
    } catch {
      // Soft failure -- the rest of the page still works.
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
      <button
        type='button'
        onClick={onBack}
        className='inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900'
      >
        <ArrowLeft className='h-4 w-4' /> All tickets
      </button>

      {loading ? (
        <div className='mt-6 flex justify-center'>
          <Loader2 className='h-6 w-6 animate-spin text-orange-500' />
        </div>
      ) : ticket ? (
        <>
          <div className='mt-4 flex items-center justify-between gap-3'>
            <h2 className='text-lg font-bold text-slate-900'>{ticket.subject}</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[ticket.status]}`}>
              {STATUS_LABEL[ticket.status]}
            </span>
          </div>

          <div className='mt-5 space-y-3'>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  message.sender_type === 'staff' ? 'bg-slate-900 text-white' : 'ml-auto bg-orange-50 text-slate-900'
                }`}
              >
                <p className='whitespace-pre-wrap'>{message.body}</p>
                <p className={`mt-1 text-xs ${message.sender_type === 'staff' ? 'text-slate-400' : 'text-gray-400'}`}>
                  {message.sender_type === 'staff' ? 'Support' : 'You'} &middot;{' '}
                  {new Date(message.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {ticket.status !== 'closed' && (
            <div className='mt-5 flex gap-2 border-t border-gray-100 pt-4'>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                placeholder='Type a reply...'
                className='flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
              />
              <button
                type='button'
                onClick={handleReply}
                disabled={isSending || !reply.trim()}
                className='inline-flex items-center gap-2 self-end rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60'
              >
                <Send className='h-4 w-4' />
              </button>
            </div>
          )}
        </>
      ) : (
        <p className='mt-6 text-sm text-gray-500'>Ticket not found.</p>
      )}
    </div>
  )
}

export default function SellerSupportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    searchParams.get('ticket'),
  )

  const loadTickets = async () => {
    setLoading(true)
    try {
      const result = await sellerSupportApi.list({ limit: 30 })
      setTickets(result.items)
    } catch {
      // Soft failure -- the rest of the page still works.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [])

  const handleSelectTicket = (id: string | null) => {
    setSelectedTicketId(id)
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (id) {
          next.set('ticket', id)
        } else {
          next.delete('ticket')
        }
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className='max-w-3xl'>
      <SellerPageHeader
        title='Support'
        description='A real conversation with our team -- ask about payouts, verification, listings, or anything else.'
      />

      <div className='mt-6 space-y-6'>
          {selectedTicketId ? (
            <TicketThread ticketId={selectedTicketId} onBack={() => handleSelectTicket(null)} />
          ) : (
            <>
              <NewTicketForm
                onCreated={(ticket) => {
                  setTickets((current) => [ticket, ...current])
                  handleSelectTicket(ticket.id)
                }}
              />

              <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
                <h2 className='text-lg font-bold text-slate-900'>Your tickets</h2>
                <div className='mt-4 space-y-2'>
                  {loading ? (
                    <div className='flex items-center gap-2 text-sm text-gray-500'>
                      <Loader2 className='h-4 w-4 animate-spin' /> Loading...
                    </div>
                  ) : tickets.length === 0 ? (
                    <p className='text-sm text-gray-500'>No tickets yet -- create one above.</p>
                  ) : (
                    tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        type='button'
                        onClick={() => handleSelectTicket(ticket.id)}
                        className='flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100'
                      >
                        <div>
                          <p className='text-sm font-semibold text-slate-900'>{ticket.subject}</p>
                          <p className='text-xs text-gray-500'>
                            {new Date(ticket.last_message_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[ticket.status]}`}>
                          {STATUS_LABEL[ticket.status]}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
    </div>
  )
}
