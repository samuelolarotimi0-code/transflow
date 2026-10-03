'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useGroqKey } from '@/lib/hooks'
import { toast } from 'sonner'

interface GroqSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GroqSettingsDialog({ open, onOpenChange }: GroqSettingsDialogProps) {
  const { groqKey, hasEnvKey, isConfigured, saveKey } = useGroqKey()
  const [inputKey, setInputKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ valid: boolean; message?: string } | null>(null)

  useEffect(() => {
    if (open) {
      setInputKey(groqKey)
      setTestResult(null)
    }
  }, [open, groqKey])

  const handleTestKey = async (keyToTest: string) => {
    const key = keyToTest.trim()
    if (!key) {
      toast.error('Please enter an API key to test')
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      })
      const data = await res.json()
      if (res.ok && data.valid) {
        setTestResult({ valid: true, message: data.message || 'Groq API key verified!' })
        toast.success('Groq API key is valid and connected!')
      } else {
        setTestResult({ valid: false, message: data.error || 'Invalid API key' })
        toast.error(data.error || 'Groq key test failed')
      }
    } catch (err: any) {
      setTestResult({ valid: false, message: err.message || 'Network error' })
      toast.error('Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    saveKey(inputKey.trim())
    toast.success(inputKey.trim() ? 'Groq API key saved' : 'Groq API key removed')
    onOpenChange(false)
  }

  const handleClear = () => {
    setInputKey('')
    saveKey('')
    setTestResult(null)
    toast.info('Groq API key cleared')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg">Groq AI Settings</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Connect your Groq API key for ultra-fast multilingual transcript translation and AI summaries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status Banner */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/40 text-xs">
            <span className="font-medium text-muted-foreground">Current Status</span>
            {hasEnvKey ? (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Active via .env
              </Badge>
            ) : isConfigured ? (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-300 text-amber-600 dark:text-amber-400 gap-1">
                <AlertCircle className="h-3 w-3" />
                Key Required
              </Badge>
            )}
          </div>

          {/* Key Input */}
          <div className="space-y-2">
            <Label htmlFor="groq-key" className="text-xs font-medium flex items-center justify-between">
              <span>Groq API Key</span>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                Get free key <ExternalLink className="h-3 w-3" />
              </a>
            </Label>
            <div className="relative">
              <Input
                id="groq-key"
                type={showKey ? 'text' : 'password'}
                placeholder="gsk_..."
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value)
                  setTestResult(null)
                }}
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {hasEnvKey && !inputKey && (
              <p className="text-[11px] text-muted-foreground">
                A key is already configured on the server via <code className="px-1 py-0.5 rounded bg-muted">GROQ_API_KEY</code>. You can override it here if needed.
              </p>
            )}
          </div>

          {/* Test connection output */}
          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-lg p-2.5 text-xs ${
                testResult.valid
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {testResult.valid ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
              )}
              <span className="leading-tight">{testResult.message}</span>
            </div>
          )}

          {/* Model info banner */}
          <div className="rounded-lg border border-dashed border-border/80 p-3 bg-muted/20 text-[11px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
              <span>Model: GPT-OSS 120B (selected from models available to your key)</span>
            </div>
            <p>
              Groq delivers near-instant inference speed (~500+ tokens/sec) for high-accuracy translation into dozens of languages.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-row sm:justify-between items-center gap-2 pt-2">
          {inputKey ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-destructive hover:bg-destructive/10 text-xs px-2"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testing || !inputKey.trim()}
              onClick={() => handleTestKey(inputKey)}
              className="text-xs"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Test Key
            </Button>
            <Button type="button" size="sm" onClick={handleSave} className="text-xs">
              Save & Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
