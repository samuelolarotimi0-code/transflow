'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
  Info,
  Undo2,
  Redo2,
  Search,
  Replace,
  Type,
  CaseUpper,
  CaseLower,
  AlignLeft,
  Clock,
  RotateCcw,
  Languages,
  Edit3,
  Eye,
  X,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LanguageSelect } from './language-select'
import { TranslateDialog } from './translate-dialog'
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
  const [originalTranscript, setOriginalTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null)

  // Text editor states
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')
  const [history, setHistory] = useState<string[]>([''])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [translateDialogOpen, setTranslateDialogOpen] = useState(false)
  const [isDirectEditing, setIsDirectEditing] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptRef = useRef('')
  const isRecordingRef = useRef(false)

  // Keep refs in sync with state for closures
  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  // Check browser support on mount
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    setSpeechSupported(supported)
  }, [])

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const stopRecognition = useCallback(() => {
    stopTimer()
    const rec = recognitionRef.current
    if (rec) {
      try { rec.onresult = null } catch {}
      try { rec.onerror = null } catch {}
      try { rec.onend = null } catch {}
      try { rec.stop() } catch {}
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopRecognition()
  }, [stopRecognition])

  // Text history manager
  const updateTranscript = useCallback((newText: string, addToHistory = true) => {
    setTranscript(newText)
    transcriptRef.current = newText
    if (addToHistory) {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1)
        if (sliced[sliced.length - 1] === newText) return sliced
        return [...sliced, newText]
      })
      setHistoryIndex((prev) => prev + 1)
    }
  }, [historyIndex])

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1
      const prevText = history[prevIndex]
      setHistoryIndex(prevIndex)
      setTranscript(prevText)
      transcriptRef.current = prevText
    }
  }, [history, historyIndex])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1
      const nextText = history[nextIndex]
      setHistoryIndex(nextIndex)
      setTranscript(nextText)
      transcriptRef.current = nextText
    }
  }, [history, historyIndex])

  const startRecording = () => {
    setError(null)
    setIsConnecting(true)

    const SpeechRecognitionImpl =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionImpl) {
      setError('Your browser does not support live speech recognition. Try Chrome or Edge.')
      setIsConnecting(false)
      return
    }

    const rec = new SpeechRecognitionImpl()
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    // Map language codes to BCP-47 tags
    if (language !== 'auto') {
      const bcp47Map: Record<string, string> = {
        zh: 'zh-CN',
        pt: 'pt-PT',
      }
      rec.lang = bcp47Map[language] ?? language
    }

    recognitionRef.current = rec

    rec.onstart = () => {
      setIsConnecting(false)
      setIsRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    }

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript
        if (result.isFinal) {
          finalText += text
        } else {
          interimText += text
        }
      }
      if (finalText) {
        setTranscript((prev) => {
          const cleaned = finalText.trim()
          const next = prev ? prev + ' ' + cleaned : cleaned
          // Track original speech
          setOriginalTranscript((orig) => (orig ? orig + ' ' + cleaned : cleaned))
          // Push to history
          setHistory((h) => [...h, next])
          setHistoryIndex((idx) => idx + 1)
          return next
        })
        setInterim('')
      }
      if (interimText) {
        setInterim(interimText)
      }
    }

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') return // non-fatal
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone permission denied. Allow access and try again.',
        'audio-capture': 'No microphone found or it is in use by another app.',
        network: 'Network error — check your connection.',
        aborted: 'Recording stopped.',
      }
      setError(messages[event.error] ?? `Speech error: ${event.error}`)
      stopRecording()
    }

    // Restart automatically in continuous mode unless user stopped
    rec.onend = () => {
      if (isRecordingRef.current) {
        try { recognitionRef.current?.start() } catch {}
      } else {
        stopTimer()
        setIsRecording(false)
        setInterim('')
      }
    }

    try {
      rec.start()
    } catch (e: any) {
      setError(e.message || 'Could not start recording')
      setIsConnecting(false)
    }
  }

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false
    setIsRecording(false)
    setIsConnecting(false)
    setInterim('')
    setError(null)
    stopRecognition()
    setIsDirectEditing(true)
  }, [stopRecognition])

  const clearTranscript = () => {
    setTranscript('')
    setOriginalTranscript('')
    setInterim('')
    setDuration(0)
    setHistory([''])
    setHistoryIndex(0)
    setShowFindReplace(false)
    setIsDirectEditing(false)
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
    if (!transcriptRef.current) return
    await navigator.clipboard.writeText(transcriptRef.current)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    toast.success('Transcript copied to clipboard')
  }

  // --- Text editing functions ---

  const handleSentenceCase = () => {
    if (!transcript) return
    // Remove space before punctuation, ensure space after
    let s = transcript.replace(/\s+([,.\?!:;])/g, '$1')
    s = s.replace(/([,.\?!:;])([a-zA-Z])/g, '$1 $2')
    s = s.replace(/[ \t]+/g, ' ')
    // Capitalize beginning of sentences
    s = s.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase())
    if (s && !/[.!?]$/.test(s.trim())) s = s.trim() + '.'
    updateTranscript(s)
    toast.success('Fixed capitalization & punctuation')
  }

  const handleTitleCase = () => {
    if (!transcript) return
    const s = transcript.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())
    updateTranscript(s)
    toast.success('Converted to Title Case')
  }

  const handleUppercase = () => {
    if (!transcript) return
    updateTranscript(transcript.toUpperCase())
    toast.success('Converted to UPPERCASE')
  }

  const handleLowercase = () => {
    if (!transcript) return
    updateTranscript(transcript.toLowerCase())
    toast.success('Converted to lowercase')
  }

  const handleCleanSpacing = () => {
    if (!transcript) return
    const cleaned = transcript
      .split('\n')
      .map((line) => line.trim().replace(/[ \t]+/g, ' '))
      .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== ''))
      .join('\n')
      .trim()
    updateTranscript(cleaned)
    toast.success('Cleaned whitespace and extra spaces')
  }

  const handleFormatParagraphs = () => {
    if (!transcript) return
    const sentences = transcript.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [transcript]
    const paragraphs: string[] = []
    let current = ''
    sentences.forEach((sent, idx) => {
      current += (current ? ' ' : '') + sent.trim()
      if ((idx + 1) % 3 === 0 || idx === sentences.length - 1) {
        paragraphs.push(current)
        current = ''
      }
    })
    updateTranscript(paragraphs.join('\n\n'))
    toast.success('Organized into paragraphs')
  }

  const handleInsertTimestamp = () => {
    const ts = duration > 0 ? `[${formatDuration(duration)}] ` : `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] `
    const el = textareaRef.current
    if (el) {
      const start = el.selectionStart || 0
      const end = el.selectionEnd || 0
      const next = transcript.slice(0, start) + ts + transcript.slice(end)
      updateTranscript(next)
      setTimeout(() => {
        el.focus()
        el.setSelectionRange(start + ts.length, start + ts.length)
      }, 20)
    } else {
      updateTranscript(transcript ? transcript + '\n' + ts : ts)
    }
  }

  const handleRevertToOriginal = () => {
    if (!originalTranscript) return
    updateTranscript(originalTranscript)
    toast.info('Reverted to original transcription')
  }

  // Find & Replace match counter
  const matchRegex = findQuery
    ? new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi')
    : null
  const matchesCount = matchRegex ? (transcript.match(matchRegex) || []).length : 0

  const handleReplaceOne = () => {
    if (!findQuery) return
    const regex = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? '' : 'i')
    const next = transcript.replace(regex, replaceQuery)
    if (next !== transcript) {
      updateTranscript(next)
      toast.success('Replaced 1 occurrence')
    } else {
      toast.info('No matches found to replace')
    }
  }

  const handleReplaceAll = () => {
    if (!findQuery) return
    const regex = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi')
    const count = (transcript.match(regex) || []).length
    if (count === 0) {
      toast.info('No matches found to replace')
      return
    }
    const next = transcript.replace(regex, replaceQuery)
    updateTranscript(next)
    toast.success(`Replaced ${count} occurrence${count === 1 ? '' : 's'}`)
  }

  // Handle translation application
  const handleApplyTranslation = (translatedText: string, targetLang: string, mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      updateTranscript(translatedText)
    } else {
      const combined = transcript.trim()
        ? `${transcript.trim()}\n\n--- Translation (${targetLang.toUpperCase()}) ---\n${translatedText}`
        : translatedText
      updateTranscript(combined)
    }
  }

  const words = wordCount(transcript)
  const chars = transcript.length
  const isEdited = Boolean(originalTranscript && transcript !== originalTranscript)

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
              Capture audio from your microphone and watch it transcribe in real time. Once finished, you can edit, format, and translate your text with Groq AI.
            </p>
          </div>

          {speechSupported === false && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Live speech recognition is not supported in this browser. Please use Chrome or Edge.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Spoken Language</label>
            <LanguageSelect value={language} onChange={setLanguage} className="w-full" />
            {language === 'auto' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                Browser will use your system locale for auto-detect
              </p>
            )}
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
                    ? 'Recording speech…'
                    : 'Ready'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRecording
                  ? formatDuration(duration)
                  : 'Click the mic to speak or start typing on the right'}
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
                Done speaking & edit
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
              disabled={!transcript.trim() || saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Save & summarize
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => save(false)} disabled={!transcript.trim() || saving} variant="outline" size="sm">
                <Save className="mr-2 h-4 w-4" />
                Save only
              </Button>
              <Button onClick={clearTranscript} disabled={!transcript && !originalTranscript} variant="outline" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transcript panel - Fully Editable with Rich Text Functions & Groq Translation */}
      <Card className="flex flex-col min-h-[460px] shadow-sm">
        <CardContent className="p-0 flex flex-col flex-1">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
            <div className="flex items-center gap-2 flex-wrap">
              <Radio className={`h-4 w-4 ${isRecording ? 'text-rose-500 tf-blink' : 'text-muted-foreground'}`} />
              <span className="text-sm font-semibold">Transcript</span>
              {words > 0 && (
                <Badge variant="secondary" className="text-[11px] font-normal px-2">
                  {words} words
                </Badge>
              )}
              {isEdited && (
                <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800">
                  Edited
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Translate button */}
              <Button
                onClick={() => setTranslateDialogOpen(true)}
                disabled={!transcript.trim() || isRecording}
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
              >
                <Languages className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Translate</span>
              </Button>

              {/* View/Edit Toggle */}
              {transcript && !isRecording && (
                <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
                  <button
                    onClick={() => setViewMode('edit')}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      viewMode === 'edit'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Edit text"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('preview')}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      viewMode === 'preview'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Reading preview"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Copy button */}
              <Button
                onClick={copyTranscript}
                disabled={!transcript}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Copy to clipboard"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Text Editing Toolbar (Shown when text is editable) */}
          {(transcript || isDirectEditing) && !isRecording && viewMode === 'edit' && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 text-xs flex-wrap gap-1">
              <div className="flex items-center gap-1">
                {/* Undo & Redo */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={historyIndex <= 0}
                  onClick={handleUndo}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={historyIndex >= history.length - 1}
                  onClick={handleRedo}
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>

                <div className="h-4 w-px bg-border mx-1" />

                {/* Find & Replace toggle */}
                <Button
                  variant={showFindReplace ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => setShowFindReplace(!showFindReplace)}
                  title="Find & Replace"
                >
                  <Search className="h-3 w-3" />
                  <span>Find</span>
                </Button>

                {/* Formatting Tools Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                      <Type className="h-3 w-3" />
                      <span>Format</span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel className="text-xs">Transformations</DropdownMenuLabel>
                    <DropdownMenuItem onClick={handleSentenceCase} className="text-xs">
                      <Type className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                      Fix Punctuation &amp; Sentence case
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleTitleCase} className="text-xs">
                      <CaseUpper className="h-3.5 w-3.5 mr-2" />
                      Title Case
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleUppercase} className="text-xs">
                      <CaseUpper className="h-3.5 w-3.5 mr-2" />
                      UPPERCASE
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLowercase} className="text-xs">
                      <CaseLower className="h-3.5 w-3.5 mr-2" />
                      lowercase
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleFormatParagraphs} className="text-xs">
                      <AlignLeft className="h-3.5 w-3.5 mr-2 text-blue-600" />
                      Format into Paragraphs
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCleanSpacing} className="text-xs">
                      <AlignLeft className="h-3.5 w-3.5 mr-2" />
                      Clean Extra Spaces
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleInsertTimestamp} className="text-xs">
                      <Clock className="h-3.5 w-3.5 mr-2 text-amber-600" />
                      Insert Timestamp
                    </DropdownMenuItem>
                    {isEdited && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleRevertToOriginal} className="text-xs text-rose-600 dark:text-rose-400">
                          <RotateCcw className="h-3.5 w-3.5 mr-2" />
                          Revert to Original Speech
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Quick Timestamp insertion */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 hidden sm:flex"
                  onClick={handleInsertTimestamp}
                  title="Insert timestamp at cursor"
                >
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>Time</span>
                </Button>
              </div>

              <div className="text-[11px] text-muted-foreground hidden sm:block">
                Click text to edit freely
              </div>
            </div>
          )}

          {/* Expandable Find & Replace Bar */}
          {showFindReplace && !isRecording && (
            <div className="p-3 border-b bg-muted/40 space-y-2 tf-fade-in">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Find..."
                    value={findQuery}
                    onChange={(e) => setFindQuery(e.target.value)}
                    className="h-8 text-xs pr-16"
                  />
                  {findQuery && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                      {matchesCount} {matchesCount === 1 ? 'match' : 'matches'}
                    </span>
                  )}
                </div>
                <Input
                  placeholder="Replace with..."
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReplaceOne}
                  disabled={!findQuery}
                  className="h-8 text-xs px-2.5 shrink-0"
                >
                  Replace
                </Button>
                <Button
                  size="sm"
                  onClick={handleReplaceAll}
                  disabled={!findQuery}
                  className="h-8 text-xs px-2.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Replace All
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowFindReplace(false)}
                  className="h-8 w-8 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={matchCase}
                    onChange={(e) => setMatchCase(e.target.checked)}
                    className="rounded border-input text-emerald-600 focus:ring-emerald-500 h-3 w-3"
                  />
                  Match case
                </label>
              </div>
            </div>
          )}

          {/* Transcript Content Area */}
          <div className="flex-1 flex flex-col p-4 min-h-[360px]">
            {isRecording ? (
              // Live recording view (streaming text + blinking cursor)
              <ScrollArea className="flex-1 tf-scroll">
                <div className="p-2 space-y-2">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-normal">
                    {transcript}
                    {interim && <span className="text-muted-foreground italic"> {interim}</span>}
                    <span className="tf-blink text-emerald-600 font-bold"> ▋</span>
                  </p>
                </div>
              </ScrollArea>
            ) : transcript || isDirectEditing ? (
              viewMode === 'edit' ? (
                // Editable Text Area
                <textarea
                  ref={textareaRef}
                  value={transcript}
                  onChange={(e) => updateTranscript(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                      if (e.shiftKey) {
                        e.preventDefault()
                        handleRedo()
                      } else {
                        e.preventDefault()
                        handleUndo()
                      }
                    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                      e.preventDefault()
                      handleRedo()
                    }
                  }}
                  placeholder="Your live transcript appears here. You can edit this text directly or speak with the microphone..."
                  className="w-full flex-1 p-3 text-sm leading-relaxed resize-none rounded-lg border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans min-h-[340px]"
                  spellCheck
                />
              ) : (
                // Formatted Preview View
                <ScrollArea className="flex-1 tf-scroll border rounded-lg p-4 bg-muted/10">
                  <div className="space-y-4">
                    {transcript.split('\n\n').map((para, i) => (
                      <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
                        {para}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              )
            ) : (
              // Empty State - Friendly onboarding prompt
              <div className="flex flex-col items-center justify-center flex-1 my-auto text-center py-12 px-4">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                  <Mic className="h-8 w-8" />
                </div>
                <p className="text-base font-semibold">Your live transcript appears here</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
                  Press the microphone button to begin. Speech is streamed to the transcription service and returned as text.
                </p>
                <div className="mt-5 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => {
                      setIsDirectEditing(true)
                      setTimeout(() => textareaRef.current?.focus(), 50)
                    }}
                  >
                    <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                    Write or paste text manually
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Status / Stats Bar */}
          <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              {isRecording ? (
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-medium">
                  <span className="h-2 w-2 rounded-full bg-rose-500 tf-blink" />
                  Recording audio ({formatDuration(duration)})
                </div>
              ) : (
                <span>
                  {words} words · {chars} chars · ~{Math.max(1, Math.ceil(words / 150))} min read
                </span>
              )}
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Groq AI Translation Dialog */}
      <TranslateDialog
        open={translateDialogOpen}
        onOpenChange={setTranslateDialogOpen}
        text={transcript}
        currentLanguage={language}
        onApplyTranslation={handleApplyTranslation}
      />
    </div>
  )
}
