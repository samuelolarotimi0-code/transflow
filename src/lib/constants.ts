// Shared constants for languages and export formats
// Used by both frontend and backend.

export interface LanguageOption {
  code: string
  label: string
  nativeLabel: string
  flag: string
}

// Languages supported for transcription and summary output.
export const LANGUAGES: LanguageOption[] = [
  { code: 'auto', label: 'Auto-detect', nativeLabel: 'Auto', flag: '🌐' },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', flag: '🇵🇹' },
  { code: 'nl', label: 'Dutch', nativeLabel: 'Nederlands', flag: '🇳🇱' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский', flag: '🇷🇺' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', flag: '🇸🇦' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文', flag: '🇨🇳' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어', flag: '🇰🇷' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe', flag: '🇹🇷' },
  { code: 'pl', label: 'Polish', nativeLabel: 'Polski', flag: '🇵🇱' },
  { code: 'sw', label: 'Swahili', nativeLabel: 'Kiswahili', flag: '🇰🇪' },
  { code: 'yo', label: 'Yoruba', nativeLabel: 'Yorùbá', flag: '🇳🇬' },
  { code: 'ig', label: 'Igbo', nativeLabel: 'Igbo', flag: '🇳🇬' },
  { code: 'ha', label: 'Hausa', nativeLabel: 'Hausa', flag: '🇳🇬' },
]

export function getLanguageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label || code
}

export interface ExportFormat {
  id: 'txt' | 'md' | 'json' | 'srt' | 'notion' | 'trello' | 'jira'
  label: string
  description: string
  ext: string
  mime: string
  group: 'document' | 'subtitle' | 'pm'
}

export const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'txt',
    label: 'Plain Text',
    description: 'Raw transcript as .txt',
    ext: 'txt',
    mime: 'text/plain',
    group: 'document',
  },
  {
    id: 'md',
    label: 'Markdown',
    description: 'Transcript + summary as .md',
    ext: 'md',
    mime: 'text/markdown',
    group: 'document',
  },
  {
    id: 'json',
    label: 'JSON',
    description: 'Full structured data',
    ext: 'json',
    mime: 'application/json',
    group: 'document',
  },
  {
    id: 'srt',
    label: 'Subtitles (.srt)',
    description: 'Timestamped subtitle file',
    ext: 'srt',
    mime: 'text/plain',
    group: 'subtitle',
  },
  {
    id: 'notion',
    label: 'Notion (Markdown)',
    description: 'Paste into Notion pages',
    ext: 'md',
    mime: 'text/markdown',
    group: 'pm',
  },
  {
    id: 'trello',
    label: 'Trello Cards',
    description: 'Import as Trello card JSON',
    ext: 'json',
    mime: 'application/json',
    group: 'pm',
  },
  {
    id: 'jira',
    label: 'Jira Issues (CSV)',
    description: 'Import as Jira issues',
    ext: 'csv',
    mime: 'text/csv',
    group: 'pm',
  },
]

// ---- Shared types (mirror of DB model, with parsed fields) ----

export interface TranscriptSegment {
  start: number // seconds
  end: number // seconds
  text: string
}

export interface ActionItem {
  text: string
  assignee?: string
  priority?: 'high' | 'medium' | 'low'
  due?: string
}

export type SessionType = 'live' | 'upload' | 'youtube'
export type SessionStatus = 'transcribing' | 'completed' | 'failed' | 'summarizing'

export interface TranscriptionSession {
  id: string
  title: string
  type: SessionType
  source: string | null
  language: string
  status: SessionStatus
  transcript: string
  segments: TranscriptSegment[] | null
  summary: string | null
  actionItems: ActionItem[] | null
  duration: number | null
  createdAt: string
  updatedAt: string
}
