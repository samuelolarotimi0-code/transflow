'use client'

import { useRef, useState, useCallback } from 'react'
import {
  Upload,
  FileAudio,
  FileVideo,
  Loader2,
  X,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { LanguageSelect } from './language-select'
import { type TranscriptionSession } from '@/lib/constants'
import { apiFetch } from '@/lib/hooks'
import { toast } from 'sonner'

interface UploadTabProps {
  onSaved: (session: TranscriptionSession) => void
}

const STATUSES = [
  'Uploading file…',
  'Extracting audio…',
  'Converting format…',
  'Transcribing speech…',
  'Finalizing…',
]

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadTab({ onSaved }: UploadTabProps) {
  const [language, setLanguage] = useState('auto')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusIndex, setStatusIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopProgress = () => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current)
      progressTimer.current = null
    }
  }

  const handleFile = (f: File | null) => {
    if (!f) return
    const isAudio = f.type.startsWith('audio/')
    const isVideo = f.type.startsWith('video/')
    if (!isAudio && !isVideo) {
      toast.error('Please select an audio or video file')
      return
    }
    if (f.size > 100 * 1024 * 1024) {
      toast.error('File too large (max 100 MB)')
      return
    }
    setFile(f)
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer.files?.[0]
      if (f) handleFile(f)
    },
    []
  )

  const startProgressAnimation = () => {
    setProgress(8)
    setStatusIndex(0)
    let idx = 0
    progressTimer.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p
        return p + Math.random() * 4
      })
      idx = (idx + 1) % STATUSES.length
      setStatusIndex(idx)
    }, 1800)
  }

  const transcribe = async () => {
    if (!file) return
    setProcessing(true)
    startProgressAnimation()
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('language', language)
      const data = await apiFetch<{ session: TranscriptionSession }>(
        '/api/transcribe/upload',
        { method: 'POST', body: form, json: false }
      )
      setProgress(100)
      stopProgress()
      onSaved(data.session)
      setFile(null)
      toast.success('Transcription complete')
    } catch (e: any) {
      toast.error(e.message || 'Transcription failed')
    } finally {
      stopProgress()
      setProcessing(false)
      setProgress(0)
    }
  }

  const isVideo = file?.type.startsWith('video/')

  return (
    <div className="grid lg:grid-cols-[1fr_1.3fr] gap-6">
      <Card className="h-fit">
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Upload audio or video
            </h3>
            <p className="text-sm text-muted-foreground">
              Transcribe a recorded meeting, interview, podcast, or video file. Audio is extracted automatically and sent through speech recognition.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Language</label>
            <LanguageSelect value={language} onChange={setLanguage} className="w-full" />
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !processing && inputRef.current?.click()}
            className={`relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              dragging
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-border hover:border-emerald-400 hover:bg-muted/30'
            } ${processing ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <Upload className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-medium">
                {dragging ? 'Drop file here' : 'Drag & drop or click to browse'}
              </p>
              <p className="text-xs text-muted-foreground">
                MP3, WAV, M4A, MP4, MOV, WEBM · up to 100 MB
              </p>
            </div>
          </div>

          {file && (
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2 tf-fade-in">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-card border flex items-center justify-center shrink-0">
                  {isVideo ? (
                    <FileVideo className="h-5 w-5 text-amber-600" />
                  ) : (
                    <FileAudio className="h-5 w-5 text-emerald-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(file.size)} · {file.type || 'unknown type'}
                  </p>
                </div>
                {!processing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={transcribe}
            disabled={!file || processing}
            className="w-full"
          >
            {processing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {processing ? 'Transcribing…' : 'Transcribe file'}
          </Button>
        </CardContent>
      </Card>

      {/* Status / tips panel */}
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
                      This may take a moment depending on file length.
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
                    <li>Select an audio or video file (or drag &amp; drop).</li>
                    <li>Choose a language or leave on auto-detect.</li>
                    <li>Click <strong>Transcribe file</strong> — audio is extracted and recognized.</li>
                    <li>Open the result to generate a summary &amp; action items, translate, and export.</li>
                  </ol>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <FileAudio className="h-5 w-5 text-emerald-600 mb-2" />
                    <p className="text-xs font-medium">Audio files</p>
                    <p className="text-xs text-muted-foreground">MP3, WAV, M4A, FLAC, OGG</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <FileVideo className="h-5 w-5 text-amber-600 mb-2" />
                    <p className="text-xs font-medium">Video files</p>
                    <p className="text-xs text-muted-foreground">MP4, MOV, WEBM, MKV</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    For best accuracy, use clear audio with minimal background noise. Longer files take more time to process.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
