'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  Mic,
  Upload,
  Youtube,
  Trash2,
  Sparkles,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { type TranscriptionSession } from '@/lib/constants'
import { getLanguageLabel } from '@/lib/constants'
import { apiFetch, formatRelative, wordCount } from '@/lib/hooks'
import { toast } from 'sonner'

interface LibraryTabProps {
  sessions: TranscriptionSession[]
  loading: boolean
  onOpen: (session: TranscriptionSession) => void
  onRemoved: (id: string) => void
}

const typeMeta: Record<string, { icon: typeof Mic; label: string; className: string }> = {
  live: { icon: Mic, label: 'Live', className: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  upload: { icon: Upload, label: 'Upload', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  youtube: { icon: Youtube, label: 'YouTube', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
}

export function LibraryTab({ sessions, loading, onOpen, onRemoved }: LibraryTabProps) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (typeFilter !== 'all' && s.type !== typeFilter) return false
      if (query) {
        const q = query.toLowerCase()
        return (
          s.title.toLowerCase().includes(q) ||
          s.transcript.toLowerCase().includes(q) ||
          (s.summary || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [sessions, query, typeFilter])

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' })
      onRemoved(id)
      toast.success('Session deleted')
    } catch (e: any) {
      toast.error(e.message || 'Delete failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcripts, summaries, titles…"
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="upload">Upload</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="h-9 px-3 flex items-center">
          {filtered.length} of {sessions.length}
        </Badge>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 space-y-3">
                <div className="h-4 w-2/3 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-5/6 bg-muted rounded" />
                <div className="flex gap-2 pt-2">
                  <div className="h-5 w-12 bg-muted rounded" />
                  <div className="h-5 w-14 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Inbox className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              {sessions.length === 0 ? 'No saved sessions yet' : 'No matches found'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {sessions.length === 0
                ? 'Record live audio, upload a file, or transcribe a YouTube video to get started.'
                : 'Try a different search or filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const meta = typeMeta[s.type] || typeMeta.upload
            const Icon = meta.icon
            const preview = s.transcript.slice(0, 140)
            const words = wordCount(s.transcript)
            return (
              <Card
                key={s.id}
                className="group hover:shadow-md hover:border-emerald-400/60 transition-all cursor-pointer flex flex-col tf-fade-in"
                onClick={() => onOpen(s)}
              >
                <CardContent className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Badge variant="secondary" className={meta.className}>
                        {meta.label}
                      </Badge>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete session?</AlertDialogTitle>
                          <AlertDialogDescription>
                            &ldquo;{s.title}&rdquo; will be permanently removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(s.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <h3 className="text-sm font-semibold leading-snug line-clamp-2 mb-1">
                    {s.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-3 flex-1">
                    {preview || '— no transcript —'}
                    {s.transcript.length > 140 ? '…' : ''}
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t">
                    <Badge variant="outline" className="text-[10px] font-normal gap-1">
                      <FileText className="h-3 w-3" />
                      {getLanguageLabel(s.language)}
                    </Badge>
                    {s.summary ? (
                      <Badge variant="outline" className="text-[10px] font-normal gap-1 text-emerald-700 dark:text-emerald-400">
                        <Sparkles className="h-3 w-3" />
                        Summary
                      </Badge>
                    ) : null}
                    {s.actionItems && s.actionItems.length > 0 ? (
                      <Badge variant="outline" className="text-[10px] font-normal gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {s.actionItems.length} actions
                      </Badge>
                    ) : null}
                    <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelative(s.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
