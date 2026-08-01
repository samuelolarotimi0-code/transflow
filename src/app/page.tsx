'use client'

import { useState } from 'react'
import {
  Mic,
  Upload,
  Youtube,
  Library,
  AudioLines,
  Heart,
  Globe,
  Sparkles,
  FileDown,
  CheckSquare,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { LiveTab } from '@/components/transcription/live-tab'
import { UploadTab } from '@/components/transcription/upload-tab'
import { YoutubeTab } from '@/components/transcription/youtube-tab'
import { LibraryTab } from '@/components/transcription/library-tab'
import { SessionDetail } from '@/components/transcription/session-detail'
import { useSessions } from '@/lib/hooks'
import type { TranscriptionSession } from '@/lib/constants'

export default function Home() {
  const { sessions, loading, refresh, remove, upsert } = useSessions()
  const [activeTab, setActiveTab] = useState('live')
  const [detailSession, setDetailSession] = useState<TranscriptionSession | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const handleSaved = (session: TranscriptionSession) => {
    upsert(session)
    setDetailSession(session)
    setDetailOpen(true)
    setActiveTab('library')
  }

  const handleOpen = (session: TranscriptionSession) => {
    setDetailSession(session)
    setDetailOpen(true)
  }

  const handleUpdate = (session: TranscriptionSession) => {
    upsert(session)
    setDetailSession(session)
  }

  const handleDelete = (id: string) => {
    remove(id)
    setDetailOpen(false)
  }

  const handleRemoved = (id: string) => {
    remove(id)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <AudioLines className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-bold tracking-tight">TranscriptFlow</h1>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                Live &amp; video transcription · AI summaries
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex text-muted-foreground"
              onClick={() => setActiveTab('library')}
            >
              <Library className="h-4 w-4 mr-2" />
              Library
              {sessions.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                  {sessions.length}
                </Badge>
              )}
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-emerald-50/60 to-background dark:from-emerald-950/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4 gap-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Sparkles className="h-3 w-3" />
              AI-powered transcription workspace
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance">
              Transcribe anything.{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Summarize instantly.
              </span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl text-pretty">
              Capture live audio, upload videos, or paste a YouTube link. Get accurate
              transcripts in 20+ languages, auto-generated summaries, and key action items —
              ready to export to your favorite tools.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-emerald-600" /> 20+ languages
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-600" /> AI summaries
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckSquare className="h-4 w-4 text-emerald-600" /> Action items
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileDown className="h-4 w-4 text-emerald-600" /> 7 export formats
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-4 mb-6">
            <TabsTrigger value="live" className="gap-1.5">
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Live</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="youtube" className="gap-1.5">
              <Youtube className="h-4 w-4" />
              <span className="hidden sm:inline">YouTube</span>
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-1.5 relative">
              <Library className="h-4 w-4" />
              <span className="hidden sm:inline">Library</span>
              {sessions.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
                  {sessions.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-0 focus-visible:outline-none">
            <LiveTab onSaved={handleSaved} />
          </TabsContent>
          <TabsContent value="upload" className="mt-0 focus-visible:outline-none">
            <UploadTab onSaved={handleSaved} />
          </TabsContent>
          <TabsContent value="youtube" className="mt-0 focus-visible:outline-none">
            <YoutubeTab onSaved={handleSaved} />
          </TabsContent>
          <TabsContent value="library" className="mt-0 focus-visible:outline-none">
            <LibraryTab
              sessions={sessions}
              loading={loading}
              onOpen={handleOpen}
              onRemoved={handleRemoved}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <AudioLines className="h-3.5 w-3.5 text-white" />
            </div>
            <span>
              <strong className="text-foreground">TranscriptFlow</strong> — live &amp; video transcription with AI.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> Multi-language
            </span>
            <span className="inline-flex items-center gap-1">
              <FileDown className="h-3.5 w-3.5" /> Notion · Trello · Jira
            </span>
            <span className="inline-flex items-center gap-1">
              Built with <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
            </span>
          </div>
        </div>
      </footer>

      {/* Session detail dialog */}
      <SessionDetail
        session={detailSession}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o)
          if (!o) refresh()
        }}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  )
}
