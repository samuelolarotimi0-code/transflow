import type { TranscriptionSession, TranscriptSegment, ActionItem } from './constants'

// Prisma stores segments and actionItems as JSON strings.
// This helper converts a raw Prisma row into the clean API shape.
import type { TranscriptionSession as PrismaSession } from '@prisma/client'

export function mapSession(row: PrismaSession): TranscriptionSession {
  let segments: TranscriptSegment[] | null = null
  if (row.segments) {
    try {
      segments = JSON.parse(row.segments) as TranscriptSegment[]
    } catch {
      segments = null
    }
  }

  let actionItems: ActionItem[] | null = null
  if (row.actionItems) {
    try {
      actionItems = JSON.parse(row.actionItems) as ActionItem[]
    } catch {
      actionItems = null
    }
  }

  return {
    id: row.id,
    title: row.title,
    type: row.type as TranscriptionSession['type'],
    source: row.source,
    language: row.language,
    status: row.status as TranscriptionSession['status'],
    transcript: row.transcript,
    segments,
    summary: row.summary,
    actionItems,
    duration: row.duration,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
