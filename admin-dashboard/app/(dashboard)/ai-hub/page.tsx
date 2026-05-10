'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import aiService, { AiDraft, AiChannel, AiDraftStatus } from '@/services/ai.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Bot,
  Mail,
  MessageSquare,
  Newspaper,
  Inbox,
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  AlertTriangle,
  RefreshCw,
  Eye,
  ChevronRight,
  Zap,
  Users,
  TrendingUp,
  Activity,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Channel config ──────────────────────────────────────────
const CHANNELS: { value: AiChannel; label: string; icon: React.ComponentType<{ className?: string }>; color: string; placeholder: string }[] = [
  {
    value: 'email',
    label: 'Email',
    icon: Mail,
    color: 'text-blue-500',
    placeholder: 'E.g. "Write a win-back email for Sophie who hasn\'t ordered in 60 days, mention her last purchase was a laptop stand."',
  },
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageSquare,
    color: 'text-green-500',
    placeholder: 'E.g. "Send a flash sale WhatsApp to +39333272555 — 20% off all accessories today only."',
  },
  {
    value: 'newsletter',
    label: 'Newsletter',
    icon: Newspaper,
    color: 'text-purple-500',
    placeholder: 'E.g. "Create a newsletter campaign promoting our new MacBook accessories collection, targeting all active subscribers."',
  },
  {
    value: 'contact_reply',
    label: 'Reply to Contact',
    icon: Inbox,
    color: 'text-orange-500',
    placeholder: 'E.g. "Reply to Pascaline\'s billing question — her order TT-M0FWVP7K-Y0EG is under review and will be resolved in 24 hours."',
  },
]

// ─── Status helpers ───────────────────────────────────────────
function StatusBadge({ status }: { status: AiDraftStatus }) {
  const map: Record<AiDraftStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    pending:  { label: 'Pending Review', variant: 'secondary', icon: <Clock className='h-3 w-3 mr-1' /> },
    approved: { label: 'Approved',       variant: 'default',   icon: <CheckCircle className='h-3 w-3 mr-1' /> },
    rejected: { label: 'Rejected',       variant: 'destructive', icon: <XCircle className='h-3 w-3 mr-1' /> },
    sent:     { label: 'Sent',           variant: 'default',   icon: <Send className='h-3 w-3 mr-1' /> },
    failed:   { label: 'Failed',         variant: 'destructive', icon: <AlertTriangle className='h-3 w-3 mr-1' /> },
  }
  const cfg = map[status]
  return (
    <Badge variant={cfg.variant} className='flex items-center text-xs'>
      {cfg.icon}{cfg.label}
    </Badge>
  )
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 85 ? 'text-green-600 bg-green-50' : score >= 65 ? 'text-yellow-700 bg-yellow-50' : 'text-red-600 bg-red-50'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      <Zap className='h-3 w-3 mr-1' />{score}% confidence
    </span>
  )
}

function ChannelIcon({ channel, className }: { channel: AiChannel; className?: string }) {
  const IconMap: Record<AiChannel, React.ComponentType<{ className?: string }>> = {
    email: Mail,
    whatsapp: MessageSquare,
    newsletter: Newspaper,
    contact_reply: Inbox,
  }
  const Icon = IconMap[channel]
  return <Icon className={className} />
}

// ─── Main Page ────────────────────────────────────────────────
export default function AiHubPage() {
  const queryClient = useQueryClient()
  const router = useRouter()

  // Compose state
  const [channel, setChannel] = useState<AiChannel>('email')
  const [prompt, setPrompt] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [generationStage, setGenerationStage] = useState(0)

  // Preview dialog
  const [previewDraft, setPreviewDraft] = useState<AiDraft | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)

  // Filter state
  const [filterStatus, setFilterStatus] = useState<string>('pending')

  // ─── Queries ────────────────────────────────────────────────
  const { data: statusData } = useQuery({
    queryKey: ['ai-status'],
    queryFn: aiService.getStatus,
    staleTime: 60_000,
  })

  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['ai-stats'],
    queryFn: aiService.getStats,
    refetchInterval: 30_000,
  })

  const { data: draftsData, isLoading: isLoadingDrafts, refetch: refetchDrafts } = useQuery({
    queryKey: ['ai-drafts', filterStatus],
    queryFn: () => aiService.listDrafts({ status: filterStatus as AiDraftStatus, limit: 30 }),
  })

  // ─── Mutations ───────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: aiService.generateDraft,
    onSuccess: (draft) => {
      toast.success('AI draft created — review it below before sending.')
      queryClient.invalidateQueries({ queryKey: ['ai-drafts'] })
      queryClient.invalidateQueries({ queryKey: ['ai-stats'] })
      setPrompt('')
      setRecipientEmail('')
      setRecipientPhone('')
      setRecipientName('')
      setPreviewDraft(draft)
    },
    onError: (err: any) => {
      const apiError = err.response?.data?.error
      const apiHint = err.response?.data?.hint
      toast.error(apiHint ? `${apiError}. ${apiHint}` : apiError || 'Failed to generate draft')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => aiService.approveDraft(id),
    onSuccess: (_, id) => {
      toast.success('Draft approved and sent!')
      queryClient.invalidateQueries({ queryKey: ['ai-drafts'] })
      queryClient.invalidateQueries({ queryKey: ['ai-stats'] })
      if (previewDraft?.id === id) setPreviewDraft(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to send draft')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      aiService.rejectDraft(id, reason),
    onSuccess: (_, { id }) => {
      toast.success('Draft rejected.')
      queryClient.invalidateQueries({ queryKey: ['ai-drafts'] })
      queryClient.invalidateQueries({ queryKey: ['ai-stats'] })
      setShowRejectInput(false)
      setRejectReason('')
      if (previewDraft?.id === id) setPreviewDraft(null)
    },
    onError: () => toast.error('Failed to reject draft'),
  })

  // ─── Derived ─────────────────────────────────────────────────
  const selectedChannel = CHANNELS.find((c) => c.value === channel)!
  const isConfigured = statusData?.configured !== false

  const handleGenerate = () => {
    if (!prompt.trim()) { toast.error('Please describe what you want to communicate.'); return }
    if (channel === 'email' && !recipientEmail) { toast.error('Recipient email is required for email channel.'); return }
    if (channel === 'whatsapp' && !recipientPhone) { toast.error('Recipient phone is required for WhatsApp channel.'); return }
    generateMutation.mutate({ channel, prompt, recipientEmail, recipientPhone, recipientName })
  }

  const drafts = draftsData?.drafts ?? []
  const stats = statsData

  useEffect(() => {
    if (!generateMutation.isPending) {
      setGenerationStage(0)
      return
    }

    const timer = setInterval(() => {
      setGenerationStage((prev) => (prev + 1) % 4)
    }, 1300)

    return () => clearInterval(timer)
  }, [generateMutation.isPending])

  const generationMessages = [
    'Reading customer context and communication history…',
    'Crafting tone, structure, and conversion angle…',
    'Optimizing for clarity and deliverability…',
    'Finalizing draft for your approval…',
  ]

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight flex items-center gap-2'>
            <Bot className='h-8 w-8 text-primary' />
            AI Communication Hub
          </h1>
          <p className='text-muted-foreground mt-1'>
            Generate, review, and send AI-crafted messages across every channel
          </p>
        </div>
        <div className='flex items-center gap-2'>
          {isConfigured ? (
            <Badge variant='default' className='flex items-center gap-1'>
              <Activity className='h-3 w-3' />
              {statusData?.model || 'GPT-5.5'} · Ready
            </Badge>
          ) : (
            <Badge variant='destructive' className='flex items-center gap-1'>
              <AlertTriangle className='h-3 w-3' />
              AI not configured — add OPENAI_API_KEY
            </Badge>
          )}
          <Button variant='outline' size='sm' onClick={() => { refetchDrafts() }}>
            <RefreshCw className='mr-2 h-4 w-4' />Refresh
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-5'>
        {[
          { label: 'Pending', key: 'pending', icon: Clock, color: 'text-yellow-500' },
          { label: 'Sent', key: 'sent', icon: Send, color: 'text-green-500' },
          { label: 'Rejected', key: 'rejected', icon: XCircle, color: 'text-red-400' },
          { label: 'Last 24h', key: 'last_24h', icon: TrendingUp, color: 'text-blue-500' },
          { label: 'Avg Confidence', key: 'avg_confidence', icon: Zap, color: 'text-purple-500' },
        ].map(({ label, key, icon: Icon, color }) => (
          <Card key={key}>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-xs font-medium text-muted-foreground'>{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className='h-7 w-16' />
              ) : (
                <div className='text-2xl font-bold'>
                  {key === 'avg_confidence' ? `${stats?.[key as keyof typeof stats] ?? 0}%` : (stats?.[key as keyof typeof stats] ?? 0)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='grid gap-6 lg:grid-cols-5'>
        {/* ── Compose Panel (left 2/5) ── */}
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Sparkles className='h-5 w-5 text-primary' />
              Compose with AI
            </CardTitle>
            <CardDescription>
              Describe what you want — the AI will draft it for your review.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Channel selector */}
            <div className='grid grid-cols-2 gap-2'>
              {CHANNELS.map((ch) => (
                <button
                  key={ch.value}
                  onClick={() => setChannel(ch.value)}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all hover:border-primary ${
                    channel === ch.value ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <ch.icon className={`h-4 w-4 ${ch.color}`} />
                  {ch.label}
                </button>
              ))}
            </div>

            {/* Recipient fields */}
            {(channel === 'email' || channel === 'contact_reply') && (
              <div className='space-y-2'>
                <Label htmlFor='recipient-email'>Recipient Email</Label>
                <Input
                  id='recipient-email'
                  type='email'
                  placeholder='customer@example.com'
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
            )}
            {channel === 'whatsapp' && (
              <div className='space-y-2'>
                <Label htmlFor='recipient-phone'>Recipient Phone</Label>
                <Input
                  id='recipient-phone'
                  type='tel'
                  placeholder='+39333272555'
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                />
              </div>
            )}
            {channel !== 'newsletter' && (
              <div className='space-y-2'>
                <Label htmlFor='recipient-name'>Recipient Name (optional)</Label>
                <Input
                  id='recipient-name'
                  placeholder='Customer name'
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
            )}

            {/* Prompt */}
            <div className='space-y-2'>
              <Label htmlFor='prompt'>Your instruction to the AI</Label>
              <Textarea
                id='prompt'
                rows={5}
                placeholder={selectedChannel.placeholder}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={2000}
              />
              <p className='text-xs text-muted-foreground text-right'>{prompt.length}/2000</p>
            </div>

            <Button
              className='w-full'
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !isConfigured}
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className='mr-2 h-4 w-4' />
                  Generate Draft
                </>
              )}
            </Button>

            {generateMutation.isPending && (
              <div className='rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3'>
                <div className='flex items-center justify-between text-sm'>
                  <div className='flex items-center gap-2 font-medium'>
                    <Sparkles className='h-4 w-4 text-primary animate-pulse' />
                    AI is generating your draft
                  </div>
                  <span className='text-xs text-muted-foreground'>
                    Stage {generationStage + 1}/4
                  </span>
                </div>
                <div className='h-2 w-full rounded-full bg-primary/15 overflow-hidden'>
                  <div
                    className='h-full bg-primary transition-all duration-700 ease-out'
                    style={{ width: `${(generationStage + 1) * 25}%` }}
                  />
                </div>
                <p className='text-sm text-muted-foreground'>
                  {generationMessages[generationStage]}
                </p>
              </div>
            )}

            {!isConfigured && (
              <p className='text-xs text-destructive text-center'>
                Add <code className='font-mono'>OPENAI_API_KEY</code> to the server .env to enable AI.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Drafts Queue (right 3/5) ── */}
        <Card className='lg:col-span-3'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div>
              <CardTitle>Drafts Queue</CardTitle>
              <CardDescription>Review and approve AI-generated messages before sending</CardDescription>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className='w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='pending'>Pending</SelectItem>
                <SelectItem value='approved'>Approved</SelectItem>
                <SelectItem value='rejected'>Rejected</SelectItem>
                <SelectItem value='sent'>Sent</SelectItem>
                <SelectItem value='failed'>Failed</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoadingDrafts ? (
              <div className='space-y-3'>
                {[...Array(4)].map((_, i) => <Skeleton key={i} className='h-20 w-full' />)}
              </div>
            ) : drafts.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-16 text-muted-foreground'>
                <Bot className='h-12 w-12 mb-3 opacity-30' />
                <p className='text-sm'>No {filterStatus} drafts yet.</p>
                {filterStatus === 'pending' && (
                  <p className='text-xs mt-1'>Use the composer to generate your first draft.</p>
                )}
              </div>
            ) : (
              <div className='space-y-3 max-h-140 overflow-y-auto pr-1'>
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className='rounded-lg border p-4 space-y-2 hover:border-primary/40 transition-colors'
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <div className='flex items-center gap-2 min-w-0'>
                        <ChannelIcon channel={draft.channel} className='h-4 w-4 text-muted-foreground shrink-0' />
                        <p className='text-sm font-medium truncate'>
                          {draft.subject || draft.recipientEmail || draft.recipientPhone || 'Newsletter'}
                        </p>
                      </div>
                      <div className='flex items-center gap-2 shrink-0'>
                        <ConfidenceBadge score={draft.confidence} />
                        <StatusBadge status={draft.status} />
                      </div>
                    </div>

                    <p className='text-xs text-muted-foreground line-clamp-2'>{draft.bodyText}</p>

                    <div className='flex items-center justify-between pt-1'>
                      <span className='text-xs text-muted-foreground'>
                        {new Date(draft.createdAt).toLocaleString()}
                      </span>
                      <div className='flex gap-2'>
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => setPreviewDraft(draft)}
                        >
                          <Eye className='h-3.5 w-3.5 mr-1' />Preview
                        </Button>
                        {draft.status === 'pending' && (
                          <>
                            <Button
                              size='sm'
                              variant='destructive'
                              onClick={() => { setPreviewDraft(draft); setShowRejectInput(true) }}
                            >
                              <XCircle className='h-3.5 w-3.5 mr-1' />Reject
                            </Button>
                            <Button
                              size='sm'
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(draft.id)}
                            >
                              <Send className='h-3.5 w-3.5 mr-1' />Send
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Preview / Approve / Reject Dialog ── */}
      <Dialog open={!!previewDraft} onOpenChange={(open: boolean) => { if (!open) { setPreviewDraft(null); setShowRejectInput(false); setRejectReason('') } }}>
        {previewDraft && (
          <DialogContent
            className='max-w-3xl max-h-[90vh] overflow-y-auto'
            aria-describedby='ai-draft-dialog-description'
          >
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2'>
                <ChannelIcon channel={previewDraft.channel} className='h-5 w-5' />
                Draft Preview
                <StatusBadge status={previewDraft.status} />
                <ConfidenceBadge score={previewDraft.confidence} />
              </DialogTitle>
              <DialogDescription id='ai-draft-dialog-description'>
                Generated by {previewDraft.modelName} · {new Date(previewDraft.createdAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue={previewDraft.bodyHtml ? 'html' : 'text'} className='mt-2'>
              <TabsList>
                {previewDraft.bodyHtml && <TabsTrigger value='html'>HTML Preview</TabsTrigger>}
                <TabsTrigger value='text'>Plain Text</TabsTrigger>
                <TabsTrigger value='meta'>Details</TabsTrigger>
              </TabsList>

              {previewDraft.bodyHtml && (
                <TabsContent value='html'>
                  {previewDraft.subject && (
                    <div className='mb-3 rounded-md bg-muted px-4 py-2'>
                      <span className='text-xs text-muted-foreground'>Subject: </span>
                      <span className='font-medium text-sm'>{previewDraft.subject}</span>
                    </div>
                  )}
                  <div
                    className='rounded-lg border p-4 text-sm'
                    dangerouslySetInnerHTML={{ __html: previewDraft.bodyHtml }}
                  />
                </TabsContent>
              )}

              <TabsContent value='text'>
                <pre className='whitespace-pre-wrap rounded-lg border bg-muted p-4 text-sm font-sans'>
                  {previewDraft.bodyText}
                </pre>
              </TabsContent>

              <TabsContent value='meta'>
                <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
                  <dt className='text-muted-foreground'>Channel</dt>
                  <dd className='capitalize'>{previewDraft.channel.replace('_', ' ')}</dd>
                  <dt className='text-muted-foreground'>To (email)</dt>
                  <dd>{previewDraft.recipientEmail || '—'}</dd>
                  <dt className='text-muted-foreground'>To (phone)</dt>
                  <dd>{previewDraft.recipientPhone || '—'}</dd>
                  <dt className='text-muted-foreground'>Model</dt>
                  <dd>{previewDraft.modelName}</dd>
                  <dt className='text-muted-foreground'>Tokens used</dt>
                  <dd>{previewDraft.tokenUsage?.totalTokens ?? '—'}</dd>
                  <dt className='text-muted-foreground'>Your prompt</dt>
                  <dd className='col-span-2 mt-1 rounded bg-muted px-3 py-2 text-xs'>{previewDraft.prompt}</dd>
                </dl>
              </TabsContent>
            </Tabs>

            {showRejectInput && (
              <div className='space-y-2 mt-2'>
                <Label htmlFor='reject-reason'>Rejection reason</Label>
                <Textarea
                  id='reject-reason'
                  rows={2}
                  placeholder='E.g. "Tone too aggressive, regenerate with softer language"'
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            )}

            <DialogFooter className='gap-2 mt-4'>
              {previewDraft.status === 'pending' && (
                <>
                  {!showRejectInput ? (
                    <Button variant='destructive' onClick={() => setShowRejectInput(true)}>
                      <XCircle className='mr-2 h-4 w-4' />Reject
                    </Button>
                  ) : (
                    <Button
                      variant='destructive'
                      disabled={!rejectReason.trim() || rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate({ id: previewDraft.id, reason: rejectReason })}
                    >
                      {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Reject'}
                    </Button>
                  )}
                  <Button
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(previewDraft.id)}
                  >
                    {approveMutation.isPending ? (
                      <><RefreshCw className='mr-2 h-4 w-4 animate-spin' />Sending…</>
                    ) : (
                      <><Send className='mr-2 h-4 w-4' />Approve &amp; Send</>
                    )}
                  </Button>
                </>
              )}
              <Button variant='outline' onClick={() => { setPreviewDraft(null); setShowRejectInput(false) }}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ── Quick-access links ── */}
      <div className='grid gap-4 md:grid-cols-4'>
        {[
          { label: 'Email Center', href: '/email', icon: Mail, desc: 'All sent emails & templates' },
          { label: 'WhatsApp', href: '/whatsapp', icon: MessageSquare, desc: 'WhatsApp messages' },
          { label: 'Newsletter', href: '/newsletter', icon: Newspaper, desc: 'Campaigns & subscribers' },
          { label: 'Contact Inbox', href: '/contact', icon: Inbox, desc: 'Customer tickets' },
        ].map((link) => (
          <button
            key={link.href}
            onClick={() => router.push(link.href)}
            className='group flex items-center gap-3 rounded-lg border p-4 text-left hover:border-primary hover:bg-accent transition-all'
          >
            <link.icon className='h-5 w-5 text-muted-foreground group-hover:text-primary' />
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-medium'>{link.label}</p>
              <p className='text-xs text-muted-foreground'>{link.desc}</p>
            </div>
            <ChevronRight className='h-4 w-4 text-muted-foreground group-hover:text-primary' />
          </button>
        ))}
      </div>
    </div>
  )
}
