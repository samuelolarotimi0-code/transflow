'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import {
  Mic,
  Square,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LanguageSelect } from './language-select'
import { type TranscriptionSession } from '@/lib/constants'
import { apiFetch, formatDuration, wordCount } from '@/lib/hooks'
import { toast } from 'sonner'

interface LiveTabProps {
  onSaved: (session: TranscriptionSession) => void
}

export function LiveTab({ onSaved }: LiveTabProps) {
  const [language, setLanguage] = useState('auto')
  const [isRecording, setIsRecording] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptRef = useRef('')
  const chunksSentRef = useRef(0)
  const chunksDoneRef = useRef(0)

  // keep transcriptRef in sync
  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const cleanup = useCallback(() => {
    stopTimer()

    const recorder = recorderRef.current
    if (recorder) {
      try {
        recorder.ondataavailable = null
        recorder.onstop = null
        if (recorder.state !== 'inactive') {
          recorder.stop()
        }
      } catch {}
      recorderRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    const socket = socketRef.current
    if (socket) {
      try {
        socket.emit('stop')
      } catch {}
      try {
        socket.removeAllListeners()
      } catch {}
      try {
        socket.disconnect()
      } catch {}
      socketRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

  const startRecording = async () => {
    setError(null)
    setIsConnecting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Environment-aware WebSocket connection.
      // - On localhost (no gateway): connect directly to port 3003.
      // - In the sandbox/preview (behind Caddy): use the XTransformPort query
      //   so the gateway forwards the request to port 3003.
      const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '0.0.0.0')
      const socketUrl = isLocalhost
        ? `${window.location.protocol}//${window.location.hostname}:3003`
        : '/'
      const socketOpts: Parameters<typeof io>[1] = {
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnection: false,
        timeout: 10000,
      }
      const socket = isLocalhost
        ? io(socketUrl, { ...socketOpts, path: '/' })
        : io('/?XTransformPort=3003', socketOpts)
      socketRef.current = socket

      await new Promise<void>((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('Connection timeout')), 10000)
        socket.on('connect', () => {
          clearTimeout(to)
          resolve()
        })
        socket.on('connect_error', (err: Error) => {
          clearTimeout(to)
          reject(new Error('Could not connect to transcription service'))
        })
      })

      socket.emit('start', { language })

      socket.on('transcript', (data: { text: string; isFinal: boolean }) => {
        chunksDoneRef.current += 1
        const text = (data.text || '').trim()
        if (!text) return
        if (data.isFinal) {
          setInterim('')
          setTranscript((prev) => {
            const next = prev ? prev + ' ' + text : text
            return next
          })
        } else {
          setInterim(text)
        }
      })

      socket.on('error', (data: { message: string }) => {
        // non-fatal: surface as a transient toast but keep recording
        toast.error(data.message || 'Transcription error')
      })

      socket.on('status', (data: { status: string; message?: string }) => {
        if (data.status === 'error') {
          toast.error(data.message || 'Transcription service error')
        }
      })

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && socket.connected) {
          chunksSentRef.current += 1
          try {
            const base64 = await blobToBase64(e.data)
            socket.emit('audio-chunk', { base64, mimeType: mimeType || 'audio/webm', language })
          } catch {}
        }
      }

      recorder.start(3000)
      setIsRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } catch (e: any) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow access and try again.'
          : e.message || 'Could not start recording'
      )
      cleanup()
    } finally {
      setIsConnecting(false)
    }
  }

  const stopRecording = () => {
    setIsRecording(false)
    setIsConnecting(false)
    setInterim('')
    setError(null)
    cleanup()
  }

  const clearTranscript = () => {
    setTranscript('')
    setInterim('')
    setDuration(0)
    chunksSentRef.current = 0
    chunksDoneRef.current = 0
  }

  const save = async (summarize: boolean) => {
    const text = transcriptRef.current.trim()
    if (!text) {
      toast.error('No transcript to save')
      return
    }
    if (isRecording) stopRecording()
    setSaving(true)
    try {
      const created = await apiFetch<{ session: TranscriptionSession }>(
        '/api/sessions',
        {
          method: 'POST',
          body: JSON.stringify({
            title: `Live session · ${new Date().toLocaleString()}`,
            type: 'live',
            language,
            transcript: text,
            duration,
          }),
        }
      )
      let session = created.session
      if (summarize) {
        const summed = await apiFetch<{ session: TranscriptionSession }>(
          `/api/sessions/${session.id}/summarize`,
          { method: 'POST', body: JSON.stringify({ language: language === 'auto' ? 'en' : language }) }
        )
        session = summed.session
      }
      onSaved(session)
      clearTranscript()
      toast.success(summarize ? 'Saved with summary' : 'Session saved')
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const copyTranscript = async () => {
    await navigator.clipboard.writeText(transcriptRef.current)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const words = wordCount(transcript)

  return (
    <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
      {/* Control panel */}
      <Card className="h-fit">
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Live transcription
            </h3>
            <p className="text-sm text-muted-foreground">
              Capture audio from your microphone and watch it transcribe in real time. Pick a language or let us auto-detect.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Language</label>
            <LanguageSelect value={language} onChange={setLanguage} className="w-full" />
          </div>

          {/* Mic button */}
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              {isRecording && (
                <span className="absolute inset-0 rounded-full text-rose-500 tf-pulse-ring" />
              )}
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isConnecting}
                size="icon"
                className={`h-20 w-20 rounded-full shadow-lg transition-all ${
                  isRecording
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isConnecting ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : isRecording ? (
                  <Square className="h-7 w-7" fill="currentColor" />
                ) : (
                  <Mic className="h-9 w-9" />
                )}
              </Button>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {isConnecting
                  ? 'Connecting…'
                  : isRecording
                    ? 'Recording'
                    : 'Ready'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRecording
                  ? formatDuration(duration)
                  : 'Click the mic to start'}
              </p>
            </div>
            {isRecording && (
              <Button
                onClick={stopRecording}
                variant="outline"
                size="sm"
                className="w-full border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
              >
                <Square className="mr-2 h-4 w-4" fill="currentColor" />
                Stop recording
              </Button>
            )}
          </div>

          {isRecording && (
            <div className="flex items-center justify-center gap-1.5 h-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="tf-eq-bar w-1.5 bg-emerald-500 rounded-full"
                  style={{ height: '100%', animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <Button
              onClick={() => save(true)}
              disabled={!transcript || saving}
              className="w-full"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Save & summarize
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => save(false)} disabled={!transcript || saving} variant="outline" size="sm">
                <Save className="mr-2 h-4 w-4" />
                Save only
              </Button>
              <Button onClick={clearTranscript} disabled={!transcript || isRecording} variant="outline" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transcript panel */}
      <Card className="flex flex-col min-h-[420px]">
        <CardContent className="p-0 flex flex-col flex-1">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <div className="flex items-center gap-2">
              <Radio className={`h-4 w-4 ${isRecording ? 'text-rose-500 tf-blink' : 'text-muted-foreground'}`} />
              <span className="text-sm font-medium">Transcript</span>
              {words > 0 && (
                <span className="text-xs text-muted-foreground">{words} words</span>
              )}
            </div>
            <Button
              onClick={copyTranscript}
              disabled={!transcript}
              variant="ghost"
              size="sm"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <ScrollArea className="flex-1 tf-scroll">
            <div className="p-5 min-h-[360px]">
              {transcript || interim || isRecording ? (
                <p className="text-sm leading-relaxed">
                  {transcript}
                  {interim && <span className="text-muted-foreground italic"> {interim}</span>}
                  {isRecording && <span className="tf-blink text-emerald-600"> ▋</span>}
                </p>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Mic className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Your live transcript appears here</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Press the microphone button to begin. Speech is streamed to the transcription service and returned as text.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
          {isRecording && (
            <div className="px-5 py-2 border-t bg-rose-50/50 dark:bg-rose-950/20 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 tf-blink" />
              Recording in progress · {chunksSentRef.current} chunks sent
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
