'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LanguageSelect } from './language-select'
import { Badge } from '@/components/ui/badge'
import {
  Languages,
  Loader2,
  Copy,
  Check,
  Sparkles,
  Replace,
  Plus,
} from 'lucide-react'
import { apiFetch } from '@/lib/hooks'
import { getLanguageLabel } from '@/lib/constants'
import { toast } from 'sonner'

interface TranslateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  text: string
  currentLanguage?: string
  onApplyTranslation: (translatedText: string, targetLanguage: string, mode: 'replace' | 'append') => void
}

export function TranslateDialog({
  open,
  onOpenChange,
  text,
  currentLanguage = 'en',
  onApplyTranslation,
}: TranslateDialogProps) {
  const [targetLang, setTargetLang] = useState('es')
  const [translating, setTranslating] = useState(false)
  const [translatedText, setTranslatedText] = useState('')
  const [copied, setCopied] = useState(false)

  const handleTranslate = async () => {
    if (!text.trim()) {
      toast.error('No text to translate')
      return
    }

    setTranslating(true)
    try {
      const data = await apiFetch<{ translatedText: string; targetLanguage: string; model: string }>(
        '/api/ai/translate',
        {
          method: 'POST',
          body: JSON.stringify({
            text,
            targetLanguage: targetLang,
          }),
        }
      )
      setTranslatedText(data.translatedText)
      toast.success(`Translated to ${getLanguageLabel(targetLang)}`)
    } catch (err: any) {
      toast.error(err.message || 'Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  const handleCopy = async () => {
    if (!translatedText) return
    await navigator.clipboard.writeText(translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    toast.success('Copied translation to clipboard')
  }

  const handleApply = (mode: 'replace' | 'append') => {
    if (!translatedText) return
    onApplyTranslation(translatedText, targetLang, mode)
    toast.success(mode === 'replace' ? 'Transcript replaced with translation' : 'Translation appended to transcript')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b bg-card">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Languages className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base flex items-center gap-2">
                <span>Translate with Groq AI</span>
                <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                  GPT-OSS 120B
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Translate your transcript into any language with lightning-fast Groq AI inference.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 tf-scroll">

          {/* Language Selection Bar */}
          <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-lg border">
            <div className="text-xs font-medium text-muted-foreground shrink-0">Target Language:</div>
            <LanguageSelect
              value={targetLang}
              onChange={setTargetLang}
              includeAuto={false}
              className="flex-1 h-9"
            />
            <Button
              onClick={handleTranslate}
              disabled={translating || !text.trim()}
              size="sm"
              className="h-9 px-4 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {translating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Translating…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Translate
                </>
              )}
            </Button>
          </div>

          {/* Original Preview Snippet */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Original Transcript</span>
              <span>{text.split(/\s+/).filter(Boolean).length} words</span>
            </div>
            <div className="max-h-28 overflow-y-auto rounded-md border bg-muted/20 p-2.5 text-xs text-muted-foreground font-mono leading-relaxed tf-scroll">
              {text.trim() ? text : <span className="italic">Empty transcript</span>}
            </div>
          </div>

          {/* Translated Result Output */}
          {translatedText && (
            <div className="space-y-1.5 pt-2 border-t">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Translated ({getLanguageLabel(targetLang)})
                </span>
                <Button
                  onClick={handleCopy}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm leading-relaxed whitespace-pre-wrap tf-scroll">
                {translatedText}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <DialogFooter className="p-4 border-t bg-card flex-row sm:justify-between items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>

          {translatedText ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApply('append')}
                className="text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Append Below
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleApply('replace')}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Replace className="h-3.5 w-3.5" />
                Replace Transcript
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={translating || !text.trim()}
              onClick={handleTranslate}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              Translate Now
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
