import { useCallback, useEffect, useState } from 'react'
import type { TranscriptionSession } from './constants'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Generic JSON fetch helper. Set `json` to false for multipart/formdata requests
 * (it won't set the Content-Type header so the browser sets the boundary).
 */
export async function apiFetch<T>(
  url: string,
  options: RequestInit & { json?: boolean } = {}
): Promise<T> {
  const { json = true, headers, ...rest } = options
  const res = await fetch(url, {
    ...rest,
    headers: json
      ? { 'Content-Type': 'application/json', ...(headers || {}) }
      : { ...(headers || {}) },
  })
  const text = await res.text()
  let data: any = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text }
    }
  }
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status)
  }
  return data as T
}

export function useSessions() {
  const [sessions, setSessions] = useState<TranscriptionSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ sessions: TranscriptionSession[] }>('/api/sessions')
      setSessions(data.sessions)
    } catch (e: any) {
      setError(e.message || 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const remove = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const upsert = useCallback((session: TranscriptionSession) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === session.id)
      if (idx === -1) return [session, ...prev]
      const next = [...prev]
      next[idx] = session
      return next
    })
  }, [])

  return { sessions, loading, error, refresh, remove, upsert }
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function formatRelative(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = (now - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function wordCount(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}
