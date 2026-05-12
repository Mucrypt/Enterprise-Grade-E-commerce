'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

interface BrandPreset {
  id: string
  name: string
  primary: string
  secondary: string
  text: string
  background: string
}

type BlockType = 'hero' | 'text' | 'cta' | 'divider' | 'footer'

interface EmailBlock {
  id: string
  type: BlockType
  title?: string
  text?: string
  buttonLabel?: string
  buttonUrl?: string
}

interface SavedTemplate {
  id: string
  name: string
  subject: string
  presetId: string
  blocks: EmailBlock[]
}

export interface VisualEditorApplyPayload {
  subject: string
  html: string
  text: string
}

interface VisualEmailEditorProps {
  defaultSubject?: string
  onApply: (payload: VisualEditorApplyPayload) => void
}

const BRAND_PRESETS: BrandPreset[] = [
  {
    id: 'tech-orange',
    name: 'TechTools Orange',
    primary: '#f97316',
    secondary: '#ea580c',
    text: '#0f172a',
    background: '#f8fafc',
  },
  {
    id: 'slate-pro',
    name: 'Slate Pro',
    primary: '#1e293b',
    secondary: '#334155',
    text: '#111827',
    background: '#f1f5f9',
  },
  {
    id: 'aqua-modern',
    name: 'Aqua Modern',
    primary: '#0ea5e9',
    secondary: '#0284c7',
    text: '#0f172a',
    background: '#f0f9ff',
  },
]

function blockFactory(type: BlockType): EmailBlock {
  const seed = `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  if (type === 'hero') {
    return {
      id: seed,
      type,
      title: 'Launch-worthy campaign headline',
      text: 'Announce your best new arrivals with a high-impact message.',
    }
  }

  if (type === 'text') {
    return {
      id: seed,
      type,
      title: 'Section heading',
      text: 'Use this area for launch details, key benefits, and urgency.',
    }
  }

  if (type === 'cta') {
    return {
      id: seed,
      type,
      title: 'Call to action',
      text: 'Drive customers directly to your store.',
      buttonLabel: 'Shop now',
      buttonUrl: 'https://techtoolstore.com/products',
    }
  }

  if (type === 'footer') {
    return {
      id: seed,
      type,
      text: 'You are receiving this because you subscribed to TechTools updates.',
    }
  }

  return { id: seed, type }
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderBlockHtml(block: EmailBlock, preset: BrandPreset): string {
  if (block.type === 'hero') {
    return `
      <tr>
        <td style="padding:28px 24px;background:linear-gradient(125deg,${preset.primary},${preset.secondary});color:#ffffff;text-align:center;">
          <div style="font-size:30px;font-weight:800;line-height:1.25;">${escapeHtml(block.title || '')}</div>
          <p style="margin:10px 0 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.92);">${escapeHtml(block.text || '')}</p>
        </td>
      </tr>`
  }

  if (block.type === 'text') {
    return `
      <tr>
        <td style="padding:20px 24px;color:${preset.text};">
          <h2 style="margin:0 0 8px 0;font-size:22px;line-height:1.3;">${escapeHtml(block.title || '')}</h2>
          <p style="margin:0;font-size:15px;line-height:1.75;color:#334155;">${escapeHtml(block.text || '')}</p>
        </td>
      </tr>`
  }

  if (block.type === 'cta') {
    return `
      <tr>
        <td style="padding:14px 24px 24px 24px;text-align:left;">
          <p style="margin:0 0 10px 0;font-size:14px;color:#334155;">${escapeHtml(block.text || '')}</p>
          <a href="${escapeHtml(block.buttonUrl || '#')}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:${preset.primary};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(block.buttonLabel || 'Learn more')}</a>
        </td>
      </tr>`
  }

  if (block.type === 'divider') {
    return `<tr><td style="padding:8px 24px;"><hr style="border:none;border-top:1px solid #e2e8f0;"/></td></tr>`
  }

  return `
    <tr>
      <td style="padding:16px 24px;color:#64748b;font-size:12px;line-height:1.6;">
        ${escapeHtml(block.text || '')}
      </td>
    </tr>`
}

export default function VisualEmailEditor({
  defaultSubject,
  onApply,
}: VisualEmailEditorProps) {
  const [subject, setSubject] = useState(defaultSubject || 'New campaign')
  const [presetId, setPresetId] = useState(BRAND_PRESETS[0].id)
  const [blocks, setBlocks] = useState<EmailBlock[]>([
    blockFactory('hero'),
    blockFactory('text'),
    blockFactory('cta'),
    blockFactory('divider'),
    blockFactory('footer'),
  ])
  const [dragBlockId, setDragBlockId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')

  const selectedPreset = useMemo(
    () => BRAND_PRESETS.find((preset) => preset.id === presetId) || BRAND_PRESETS[0],
    [presetId],
  )

  const html = useMemo(() => {
    const body = blocks.map((block) => renderBlockHtml(block, selectedPreset)).join('')
    return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${selectedPreset.background};font-family:Arial,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 12px 28px rgba(2,6,23,0.08);">
            ${body}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
  }, [blocks, selectedPreset, subject])

  const text = useMemo(() => {
    return blocks
      .map((block) => {
        if (block.type === 'divider') return '---------------------------'
        const rows = [block.title || '', block.text || ''].filter(Boolean)
        if (block.type === 'cta' && block.buttonLabel && block.buttonUrl) {
          rows.push(`${block.buttonLabel}: ${block.buttonUrl}`)
        }
        return rows.join('\n')
      })
      .filter(Boolean)
      .join('\n\n')
  }, [blocks])

  const storedTemplates = useMemo(() => {
    if (typeof window === 'undefined') return [] as SavedTemplate[]
    try {
      const raw = window.localStorage.getItem('newsletter-visual-editor-templates')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? (parsed as SavedTemplate[]) : []
    } catch {
      return [] as SavedTemplate[]
    }
  }, [templateName, blocks, subject, presetId])

  const updateBlock = (id: string, patch: Partial<EmailBlock>) => {
    setBlocks((prev) =>
      prev.map((block) => (block.id === id ? { ...block, ...patch } : block)),
    )
  }

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((block) => block.id !== id))
  }

  const addBlock = (type: BlockType) => {
    setBlocks((prev) => [...prev, blockFactory(type)])
  }

  const saveTemplate = () => {
    if (!templateName.trim() || typeof window === 'undefined') return

    const next: SavedTemplate = {
      id: `tpl-${Date.now()}`,
      name: templateName.trim(),
      subject,
      presetId,
      blocks,
    }

    const current = storedTemplates.filter((tpl) => tpl.name !== next.name)
    window.localStorage.setItem(
      'newsletter-visual-editor-templates',
      JSON.stringify([next, ...current].slice(0, 20)),
    )
    setTemplateName('')
  }

  const loadTemplate = (id: string) => {
    const template = storedTemplates.find((item) => item.id === id)
    if (!template) return
    setSubject(template.subject)
    setPresetId(template.presetId)
    setBlocks(template.blocks)
  }

  const onDropAt = (targetId: string) => {
    if (!dragBlockId || dragBlockId === targetId) return

    const current = [...blocks]
    const from = current.findIndex((item) => item.id === dragBlockId)
    const to = current.findIndex((item) => item.id === targetId)
    if (from < 0 || to < 0) return

    const [moved] = current.splice(from, 1)
    current.splice(to, 0, moved)
    setBlocks(current)
    setDragBlockId(null)
  }

  return (
    <div className='space-y-4 rounded-lg border p-3'>
      <div className='grid gap-3 md:grid-cols-3'>
        <div className='space-y-2 md:col-span-2'>
          <Label htmlFor='visual-subject'>Subject</Label>
          <Input
            id='visual-subject'
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
        <div className='space-y-2'>
          <Label>Brand Preset</Label>
          <select
            className='w-full rounded-md border p-2 text-sm'
            value={presetId}
            onChange={(event) => setPresetId(event.target.value)}
          >
            {BRAND_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button type='button' size='sm' variant='outline' onClick={() => addBlock('hero')}>
          Add Hero
        </Button>
        <Button type='button' size='sm' variant='outline' onClick={() => addBlock('text')}>
          Add Text
        </Button>
        <Button type='button' size='sm' variant='outline' onClick={() => addBlock('cta')}>
          Add CTA
        </Button>
        <Button type='button' size='sm' variant='outline' onClick={() => addBlock('divider')}>
          Add Divider
        </Button>
        <Button type='button' size='sm' variant='outline' onClick={() => addBlock('footer')}>
          Add Footer
        </Button>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>Drag-and-Drop Block Canvas</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {blocks.map((block) => (
              <div
                key={block.id}
                draggable
                onDragStart={() => setDragBlockId(block.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => onDropAt(block.id)}
                className='rounded-md border p-2 bg-background'
              >
                <div className='mb-2 flex items-center justify-between'>
                  <span className='text-xs font-semibold uppercase text-muted-foreground'>
                    {block.type}
                  </span>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => removeBlock(block.id)}
                  >
                    Remove
                  </Button>
                </div>
                {block.type !== 'divider' && (
                  <div className='space-y-2'>
                    {block.type !== 'footer' && (
                      <Input
                        value={block.title || ''}
                        onChange={(event) =>
                          updateBlock(block.id, { title: event.target.value })
                        }
                        placeholder='Block title'
                      />
                    )}
                    <Textarea
                      value={block.text || ''}
                      onChange={(event) =>
                        updateBlock(block.id, { text: event.target.value })
                      }
                      placeholder='Block text'
                    />
                    {block.type === 'cta' && (
                      <div className='grid gap-2 md:grid-cols-2'>
                        <Input
                          value={block.buttonLabel || ''}
                          onChange={(event) =>
                            updateBlock(block.id, {
                              buttonLabel: event.target.value,
                            })
                          }
                          placeholder='Button label'
                        />
                        <Input
                          value={block.buttonUrl || ''}
                          onChange={(event) =>
                            updateBlock(block.id, {
                              buttonUrl: event.target.value,
                            })
                          }
                          placeholder='https://...'
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>Real-time Inbox Preview Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue='gmail'>
              <TabsList className='grid grid-cols-4'>
                <TabsTrigger value='gmail'>Gmail</TabsTrigger>
                <TabsTrigger value='outlook'>Outlook</TabsTrigger>
                <TabsTrigger value='mobile'>Mobile</TabsTrigger>
                <TabsTrigger value='dark'>Dark</TabsTrigger>
              </TabsList>
              <TabsContent value='gmail' className='mt-2'>
                <iframe title='Gmail preview' className='h-96 w-full rounded border bg-white' srcDoc={html} />
              </TabsContent>
              <TabsContent value='outlook' className='mt-2'>
                <iframe
                  title='Outlook preview'
                  className='h-96 w-full rounded border bg-[#f3f4f6]'
                  srcDoc={`<div style="padding:12px;background:#f3f4f6;font-family:Calibri,Arial,sans-serif;">${html}</div>`}
                />
              </TabsContent>
              <TabsContent value='mobile' className='mt-2'>
                <div className='mx-auto h-96 max-w-[320px] overflow-hidden rounded-[22px] border bg-white'>
                  <iframe title='Mobile preview' className='h-full w-full' srcDoc={html} />
                </div>
              </TabsContent>
              <TabsContent value='dark' className='mt-2'>
                <div className='mx-auto h-96 max-w-[320px] overflow-hidden rounded-[22px] border bg-[#0b1220] p-1'>
                  <iframe
                    title='Dark mode preview'
                    className='h-full w-full rounded-[18px]'
                    style={{ filter: 'invert(0.92) hue-rotate(180deg)' }}
                    srcDoc={html}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-3 md:grid-cols-3'>
        <div className='space-y-2 md:col-span-2'>
          <Label htmlFor='template-name'>Reusable template name</Label>
          <Input
            id='template-name'
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder='Summer launch template'
          />
        </div>
        <div className='flex items-end'>
          <Button type='button' className='w-full' variant='outline' onClick={saveTemplate}>
            Save Template
          </Button>
        </div>
      </div>

      {storedTemplates.length > 0 && (
        <div className='space-y-2'>
          <Label>Load reusable template</Label>
          <div className='flex flex-wrap gap-2'>
            {storedTemplates.map((template) => (
              <Button
                key={template.id}
                type='button'
                size='sm'
                variant='ghost'
                onClick={() => loadTemplate(template.id)}
              >
                {template.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className='flex justify-end'>
        <Button
          type='button'
          onClick={() =>
            onApply({
              subject,
              html,
              text,
            })
          }
        >
          Apply To Campaign
        </Button>
      </div>
    </div>
  )
}
