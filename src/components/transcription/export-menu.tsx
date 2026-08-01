'use client'

import { useState } from 'react'
import {
  Download,
  FileText,
  FileJson,
  FileCode,
  Clapperboard,
  FileSpreadsheet,
  Clipboard,
  Check,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EXPORT_FORMATS, type TranscriptionSession } from '@/lib/constants'
import { apiFetch } from '@/lib/hooks'
import { toast } from 'sonner'

interface ExportMenuProps {
  session: TranscriptionSession
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  label?: string
  className?: string
}

const ICONS: Record<string, typeof FileText> = {
  txt: FileText,
  md: FileCode,
  json: FileJson,
  srt: Clapperboard,
  notion: FileText,
  trello: FileJson,
  jira: FileSpreadsheet,
}

export function ExportMenu({
  session,
  variant = 'outline',
  size = 'sm',
  label = 'Export',
  className,
}: ExportMenuProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleExport = async (format: string) => {
    setBusy(format)
    try {
      const data = await apiFetch<{ content: string; mimeType: string; filename: string }>(
        `/api/sessions/${session.id}/export`,
        { method: 'POST', body: JSON.stringify({ format }) }
      )
      // Trigger a download
      const blob = new Blob([data.content], { type: data.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${data.filename}`)
    } catch (e: any) {
      toast.error(e.message || 'Export failed')
    } finally {
      setBusy(null)
    }
  }

  const handleCopy = async () => {
    setBusy('copy')
    try {
      const data = await apiFetch<{ content: string; mimeType: string; filename: string }>(
        `/api/sessions/${session.id}/export`,
        { method: 'POST', body: JSON.stringify({ format: 'md' }) }
      )
      await navigator.clipboard.writeText(data.content)
      setCopied(true)
      toast.success('Copied markdown to clipboard')
      setTimeout(() => setCopied(false), 1500)
    } catch (e: any) {
      toast.error(e.message || 'Copy failed')
    } finally {
      setBusy(null)
    }
  }

  const groups: Array<'document' | 'subtitle' | 'pm'> = ['document', 'subtitle', 'pm']
  const groupLabels: Record<string, string> = {
    document: 'Documents',
    subtitle: 'Subtitles',
    pm: 'Project Management',
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={!!busy}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Export format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {groups.map((g) => (
          <DropdownMenuGroup key={g}>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {groupLabels[g]}
            </DropdownMenuLabel>
            {EXPORT_FORMATS.filter((f) => f.group === g).map((f) => {
              const Icon = ICONS[f.id] || FileText
              return (
                <DropdownMenuItem
                  key={f.id}
                  onSelect={(e) => {
                    e.preventDefault()
                    handleExport(f.id)
                  }}
                  disabled={busy === f.id}
                >
                  <Icon className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.description}</span>
                  </div>
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
          </DropdownMenuGroup>
        ))}
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleCopy() }} disabled={busy === 'copy'}>
          {copied ? (
            <Check className="mr-2 h-4 w-4 text-emerald-600" />
          ) : (
            <Clipboard className="mr-2 h-4 w-4" />
          )}
          Copy as Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
