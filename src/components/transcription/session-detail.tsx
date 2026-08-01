'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  Sparkles,
  Languages,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  User,
  AlertCircle,
} from 'lucide-react'
import { LanguageSelect } from './language-select'
import { ExportMenu } from './export-menu'
import type { TranscriptionSession, ActionItem } from '@/lib/constants'
import { getLanguageLabel } from '@/lib/constants'
import { apiFetch, formatDuration, wordCount } from '@/lib/hooks'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface SessionDetailProps {
  session: TranscriptionSession | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (session: TranscriptionSession) => void
  onDelete: (id: string) => void
}

const typeBadge: Record<string, { label: string; className: string }> = {
  live: { label: 'Live', className: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  upload: { label: 'Upload', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  youtube: { label: 'YouTube', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
}

const priorityStyles: Record<string, string> = {
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
}

export function SessionDetail({
  session,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: SessionDetailProps) {
  const [summarizing, setSummarizing] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translateLang, setTranslateLang] = useState('en')
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  if (!session) return null

  const handleSummarize = async () => {
    setSummarizing(true)
    try {
      const data = await apiFetch<{ session: TranscriptionSession }>(
        `/api/sessions/${session.id}/summarize`,
        { method: 'POST', body: JSON.stringify({ language: session.language }) }
      )
      onUpdate(data.session)
      toast.success('Summary & action items generated')
    } catch (e: any) {
      toast.error(e.message || 'Summarization failed')
    } finally {
      setSummarizing(false)
    }
  }

  const handleTranslate = async () => {
    setTranslating(true)
    try {
      const data = await apiFetch<{ session: TranscriptionSession }>(
        `/api/sessions/${session.id}/translate`,
        { method: 'POST', body: JSON.stringify({ targetLanguage: translateLang }) }
      )
      onUpdate(data.session)
      toast.success(`Translated to ${getLanguageLabel(translateLang)}`)
    } catch (e: any) {
      toast.error(e.message || 'Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  const handleDelete = async () => {
    try {
      await apiFetch(`/api/sessions/${session.id}`, { method: 'DELETE' })
      onDelete(session.id)
      onOpenChange(false)
      toast.success('Session deleted')
    } catch (e: any) {
      toast.error(e.message || 'Delete failed')
    }
  }

  const tb = typeBadge[session.type] || typeBadge.upload
  const words = wordCount(session.transcript)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        {/* Sticky header / action bar */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-card/80 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge className={tb.className} variant="secondary">{tb.label}</Badge>
                <Badge variant="outline" className="font-normal">
                  {getLanguageLabel(session.language)}
                </Badge>
                {session.duration ? (
                  <Badge variant="outline" className="font-normal gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(session.duration)}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="font-normal">{words} words</Badge>
              </div>
              <DialogTitle className="text-xl truncate">{session.title}</DialogTitle>
              {session.source && (
                <DialogDescription className="truncate text-xs">
                  {session.source}
                </DialogDescription>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ExportMenu session={session} variant="default" size="sm" />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the transcript, summary, and action items. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </DialogHeader>

        {/* Tools row */}
        <div className="px-6 py-3 border-b bg-muted/30 flex items-center gap-2 flex-wrap">
          {!session.summary && (
            <Button onClick={handleSummarize} disabled={summarizing} size="sm">
              {summarizing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {summarizing ? 'Generating…' : 'Generate summary & action items'}
            </Button>
          )}
          {session.summary && (
            <Button onClick={handleSummarize} disabled={summarizing} variant="outline" size="sm">
              {summarizing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {summarizing ? 'Regenerating…' : 'Regenerate summary'}
            </Button>
          )}
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <LanguageSelect
              value={translateLang}
              onChange={setTranslateLang}
              includeAuto={false}
              className="w-[180px]"
              placeholder="Translate to"
            />
            <Button
              onClick={handleTranslate}
              disabled={translating || translateLang === session.language}
              variant="outline"
              size="sm"
            >
              {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Translate'}
            </Button>
          </div>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1 tf-scroll">
          <div className="px-6 py-6 space-y-6">
            {session.status === 'failed' && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Transcription failed</p>
                  <p className="text-sm text-muted-foreground">Please try again with a different file or check the audio quality.</p>
                </div>
              </div>
            )}

            {/* Summary */}
            {session.summary ? (
              <section className="tf-fade-in">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Summary
                </h3>
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-semibold prose-ul:my-2 prose-li:my-0.5">
                  <ReactMarkdown>{session.summary}</ReactMarkdown>
                </div>
              </section>
            ) : !session.summary && session.status === 'completed' ? (
              <section className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">No summary yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate an AI summary with key action items using the button above.
                </p>
              </section>
            ) : null}

            {/* Action items */}
            {session.actionItems && session.actionItems.length > 0 && (
              <section className="tf-fade-in">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Action items
                  <Badge variant="secondary" className="ml-1">{session.actionItems.length}</Badge>
                </h3>
                <ul className="space-y-2">
                  {session.actionItems.map((item, i) => (
                    <ActionItemRow
                      key={i}
                      item={item}
                      checked={!!checked[i]}
                      onToggle={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                    />
                  ))}
                </ul>
              </section>
            )}

            {/* Transcript */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Transcript
              </h3>
              <div className="rounded-lg border bg-muted/20 p-4">
                {session.transcript ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{session.transcript}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No transcript available.</p>
                )}
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function ActionItemRow({
  item,
  checked,
  onToggle,
}: {
  item: ActionItem
  checked: boolean
  onToggle: () => void
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-accent/40 transition-colors">
      <button
        onClick={onToggle}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        aria-label={checked ? 'Mark as not done' : 'Mark as done'}
      >
        {checked ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${checked ? 'line-through text-muted-foreground' : ''}`}>
          {item.text}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {item.priority && (
            <Badge variant="secondary" className={`text-[10px] uppercase ${priorityStyles[item.priority] || ''}`}>
              {item.priority}
            </Badge>
          )}
          {item.assignee && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {item.assignee}
            </span>
          )}
          {item.due && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {item.due}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}
