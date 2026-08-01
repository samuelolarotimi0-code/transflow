'use client'

import { useState } from 'react'
import {
  Youtube,
  Link2,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { LanguageSelect } from './language-select'
import { type TranscriptionSession } from '@/lib/constants'
import { apiFetch } from '@/lib/hooks'
import { toast } from 'sonner'

interface YoutubeTabProps {
  onSaved: (session: TranscriptionSession) => void
}

const STATUSES = [
  'Fetching video info…',
  'Downloading audio stream…',
  'Extracting audio…',
  'Transcribing speech…',
  'Finalizing…',
]

function isValidYoutubeUrl(url: string) {
  return /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w-]{11}/.test(url)
}

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

export function YoutubeTab({ onSaved }: YoutubeTabProps) {
  const [language, setLanguage] = useState('auto')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusIndex, setStatusIndex] = useState(0)

  const videoId = url ? extractVideoId(url) : null
  const valid = url ? isValidYoutubeUrl(url) : false

  const startProgressAnimation = () => {
    setProgress(6)
    setStatusIndex(0)
    let idx = 0
    const timer = setInterval(() => {
      setProgress((p) => (p >= 94 ? p : p + Math.random() * 3))
      idx = (idx + 1) % STATUSES.length
      setStatusIndex(idx)
    }, 2200)
    return timer
  }

  const transcribe = async () => {
    if (!valid || !videoId) {
      toast.error('Enter a valid YouTube URL')
      return
    }
    setProcessing(true)
    const timer = startProgressAnimation()
    try {
      const data = await apiFetch<{ session: TranscriptionSession }>(
        '/api/transcribe/youtube',
        {
          method: 'POST',
          body: JSON.stringify({ url, language, title: title || undefined }),
        }
      )
      setProgress(100)
      clearInterval(timer)
      onSaved(data.session)
      setUrl('')
      setTitle('')
      toast.success('YouTube transcription complete')
    } catch (e: any) {
      clearInterval(timer)
      toast.error(e.message || 'YouTube transcription failed')
    } finally {
      clearInterval(timer)
      setProcessing(false)
      setProgress(0)
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_1.3fr] gap-6">
      <Card className="h-fit">
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              YouTube URL
            </h3>
            <p className="text-sm text-muted-foreground">
              Paste a YouTube link to download its audio and transcribe it automatically. Great for talks, lectures, and interviews.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Video URL</label>
            <div className="relative">
              <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className="pl-9"
                disabled={processing}
              />
            </div>
            {url && !valid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                That doesn&apos;t look like a valid YouTube URL
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Title (optional)</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Planning Meeting"
              disabled={processing}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Language</label>
            <LanguageSelect value={language} onChange={setLanguage} className="w-full" />
          </div>

          {/* Preview */}
          {videoId && (
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2 tf-fade-in">
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-28 rounded overflow-hidden bg-card border shrink-0">
                  <img
                    src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                    alt="thumbnail"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Detected video</p>
                  <p className="text-sm font-medium font-mono truncate">ID: {videoId}</p>
                </div>
              </div>
            </div>
          )}

          <Button onClick={transcribe} disabled={!valid || processing} className="w-full">
            {processing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {processing ? 'Processing…' : 'Fetch & transcribe'}
          </Button>
        </CardContent>
      </Card>

      <Card className="flex flex-col min-h-[420px]">
        <CardContent className="p-0 flex flex-col flex-1">
          <div className="px-5 py-3 border-b">
            <span className="text-sm font-medium">Status</span>
          </div>
          <div className="flex-1 p-5">
            {processing ? (
              <div className="space-y-4 tf-fade-in">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium">{STATUSES[statusIndex]}</p>
                    <p className="text-xs text-muted-foreground">
                      Downloading and transcribing — this can take 30s–3min.
                    </p>
                  </div>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  {Math.round(progress)}%
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <h4 className="text-sm font-semibold mb-2">How it works</h4>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Paste a YouTube video URL.</li>
                    <li>Pick a language or use auto-detect.</li>
                    <li>The audio stream is downloaded and converted.</li>
                    <li>Speech recognition produces the transcript.</li>
                    <li>Open the result to summarize, translate, and export.</li>
                  </ol>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start gap-3 rounded-lg border p-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Public videos work best</p>
                      <p className="text-xs text-muted-foreground">
                        Age-restricted, private, or region-locked videos may fail to download.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-3">
                    <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Processing time</p>
                      <p className="text-xs text-muted-foreground">
                        Depends on video length. Longer videos take more time to transcribe.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Ensure you have the right to transcribe and use the video&apos;s content.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
