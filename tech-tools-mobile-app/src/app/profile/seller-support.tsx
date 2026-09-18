// ============================================
// TechTools Mobile App - Seller Support Screen
// ============================================
// Mobile port of the web store's SellerSupportPage -- a real threaded
// conversation with admin staff, reachable by any seller with a profile
// at all (even unverified/pending), not gated behind full creator
// dashboard approval.

import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  sellerSupportApi,
  type SupportMessage,
  type SupportTicket,
  type SupportTicketCategory,
} from '@/api'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  open: { bg: '#FEE2E2', text: '#B91C1C' },
  in_progress: { bg: '#DBEAFE', text: '#1D4ED8' },
  resolved: { bg: '#D1FAE5', text: '#047857' },
  closed: { bg: AppColors.gray100, text: AppColors.gray600 },
}

const CATEGORIES: { value: SupportTicketCategory; label: string }[] = [
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!subject.trim()) return setError('Give your ticket a subject.')
    if (!body.trim()) return setError('Describe what you need help with.')

    setSaving(true)
    try {
      const result = await sellerSupportApi.create({ subject, category, body })
      setSubject('')
      setBody('')
      onCreated(result.ticket)
    } catch {
      setError('Could not create the ticket right now.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>New ticket</Text>

      <TextInput
        value={subject}
        onChangeText={setSubject}
        placeholder='Subject'
        placeholderTextColor={AppColors.gray400}
        style={styles.input}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        {CATEGORIES.map((option) => (
          <TouchableOpacity
            key={option.value}
            onPress={() => setCategory(option.value)}
            style={[styles.categoryChip, category === option.value && styles.categoryChipActive]}
          >
            <Text style={[styles.categoryChipText, category === option.value && styles.categoryChipTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder='What do you need help with?'
        placeholderTextColor={AppColors.gray400}
        multiline
        numberOfLines={4}
        style={[styles.input, styles.textArea]}
      />

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity onPress={handleSubmit} disabled={saving} style={styles.submitButton}>
        {saving ? <ActivityIndicator color={AppColors.white} /> : <Text style={styles.submitButtonText}>Submit ticket</Text>}
      </TouchableOpacity>
    </View>
  )
}

function TicketThread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await sellerSupportApi.getById(ticketId)
      setTicket(result.ticket)
      setMessages(result.messages)
    } catch {
      // Soft failure -- the rest of the screen still works.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const result = await sellerSupportApi.getById(ticketId)
        setTicket(result.ticket)
        setMessages(result.messages)
      } catch {
        // Soft failure -- the rest of the screen still works.
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [ticketId])

  const handleReply = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      await sellerSupportApi.reply(ticketId, reply)
      setReply('')
      await load()
    } catch {
      // Soft failure -- the rest of the screen still works.
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onBack} style={styles.backRow}>
        <Ionicons name='arrow-back' size={16} color={AppColors.gray700} />
        <Text style={styles.backRowText}>All tickets</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={AppColors.primary} style={{ marginTop: AppSpacing.lg }} />
      ) : ticket ? (
        <>
          <View style={styles.threadHeader}>
            <Text style={styles.threadTitle}>{ticket.subject}</Text>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[ticket.status].bg }]}>
              <Text style={[styles.statusPillText, { color: STATUS_COLOR[ticket.status].text }]}>
                {STATUS_LABEL[ticket.status]}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: AppSpacing.md, gap: AppSpacing.sm }}>
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.sender_type === 'staff' ? styles.messageBubbleStaff : styles.messageBubbleSeller,
                ]}
              >
                <Text style={message.sender_type === 'staff' ? styles.messageTextStaff : styles.messageTextSeller}>
                  {message.body}
                </Text>
                <Text style={message.sender_type === 'staff' ? styles.messageMetaStaff : styles.messageMetaSeller}>
                  {message.sender_type === 'staff' ? 'Support' : 'You'} &middot;{' '}
                  {new Date(message.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>

          {ticket.status !== 'closed' && (
            <View style={styles.replyRow}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder='Type a reply...'
                placeholderTextColor={AppColors.gray400}
                multiline
                style={styles.replyInput}
              />
              <TouchableOpacity onPress={handleReply} disabled={sending || !reply.trim()} style={styles.sendButton}>
                <Ionicons name='send' size={18} color={AppColors.white} />
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <Text style={styles.emptyText}>Ticket not found.</Text>
      )}
    </View>
  )
}

export default function SellerSupportScreen() {
  const router = useRouter()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const result = await sellerSupportApi.list({ limit: 30 })
        setTickets(result.items)
      } catch {
        // Soft failure -- the rest of the screen still works.
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name='arrow-back' size={22} color={AppColors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {selectedTicketId ? (
            <TicketThread ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
          ) : (
            <>
              <NewTicketForm
                onCreated={(ticket) => {
                  setTickets((current) => [ticket, ...current])
                  setSelectedTicketId(ticket.id)
                }}
              />

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Your tickets</Text>
                {loading ? (
                  <ActivityIndicator color={AppColors.primary} style={{ marginTop: AppSpacing.md }} />
                ) : tickets.length === 0 ? (
                  <Text style={styles.emptyText}>No tickets yet -- create one above.</Text>
                ) : (
                  <View style={{ marginTop: AppSpacing.md, gap: AppSpacing.sm }}>
                    {tickets.map((ticket) => (
                      <TouchableOpacity
                        key={ticket.id}
                        onPress={() => setSelectedTicketId(ticket.id)}
                        style={styles.ticketRow}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                          <Text style={styles.ticketDate}>
                            {new Date(ticket.last_message_at).toLocaleDateString()}
                          </Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[ticket.status].bg }]}>
                          <Text style={[styles.statusPillText, { color: STATUS_COLOR[ticket.status].text }]}>
                            {STATUS_LABEL[ticket.status]}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  scrollContent: {
    padding: AppSpacing.base,
    gap: AppSpacing.base,
  },
  card: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.xl,
    padding: AppSpacing.base,
    marginBottom: AppSpacing.base,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  input: {
    marginTop: AppSpacing.sm,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm + 2,
    fontSize: 14,
    color: AppColors.gray900,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  categoryRow: {
    marginTop: AppSpacing.sm,
  },
  categoryChip: {
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.xs + 2,
    borderRadius: AppBorderRadius.full,
    backgroundColor: AppColors.gray100,
    marginRight: AppSpacing.sm,
  },
  categoryChipActive: {
    backgroundColor: AppColors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.gray700,
  },
  categoryChipTextActive: {
    color: AppColors.white,
  },
  errorText: {
    marginTop: AppSpacing.sm,
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.error,
  },
  submitButton: {
    marginTop: AppSpacing.md,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
    paddingVertical: AppSpacing.sm + 4,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.white,
  },
  emptyText: {
    marginTop: AppSpacing.sm,
    fontSize: 13,
    color: AppColors.gray500,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.md,
    padding: AppSpacing.sm + 2,
  },
  ticketSubject: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  ticketDate: {
    fontSize: 11,
    color: AppColors.gray500,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backRowText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray700,
  },
  threadHeader: {
    marginTop: AppSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: AppSpacing.sm,
  },
  threadTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.md,
  },
  messageBubbleStaff: {
    backgroundColor: AppColors.gray900,
    alignSelf: 'flex-start',
  },
  messageBubbleSeller: {
    backgroundColor: '#FFF7ED',
    alignSelf: 'flex-end',
  },
  messageTextStaff: {
    color: AppColors.white,
    fontSize: 14,
  },
  messageTextSeller: {
    color: AppColors.gray900,
    fontSize: 14,
  },
  messageMetaStaff: {
    marginTop: 4,
    fontSize: 10,
    color: AppColors.gray400,
  },
  messageMetaSeller: {
    marginTop: 4,
    fontSize: 10,
    color: AppColors.gray400,
  },
  replyRow: {
    marginTop: AppSpacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: AppSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
    paddingTop: AppSpacing.md,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
