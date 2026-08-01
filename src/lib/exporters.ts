import type { TranscriptionSession, ActionItem } from './constants'

// ---- Export formatters ----
// Each takes a session and returns string content.

function escapeCsv(value: string): string {
  if (value == null) return ''
  const v = String(value)
  if (/[",\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

function fmtTimestamp(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  const ms = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000)
  const pad = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

export function toTxt(session: TranscriptionSession): string {
  const lines: string[] = []
  lines.push(session.title)
  lines.push('='.repeat(session.title.length))
  lines.push('')
  lines.push(`Type: ${session.type}`)
  lines.push(`Language: ${session.language}`)
  if (session.source) lines.push(`Source: ${session.source}`)
  if (session.duration) lines.push(`Duration: ${Math.round(session.duration)}s`)
  lines.push(`Created: ${new Date(session.createdAt).toLocaleString()}`)
  lines.push('')
  lines.push('TRANSCRIPT')
  lines.push('----------')
  lines.push(session.transcript || '(empty)')
  if (session.summary) {
    lines.push('')
    lines.push('SUMMARY')
    lines.push('-------')
    lines.push(session.summary)
  }
  if (session.actionItems && session.actionItems.length) {
    lines.push('')
    lines.push('ACTION ITEMS')
    lines.push('------------')
    session.actionItems.forEach((a, i) => {
      lines.push(`${i + 1}. ${a.text}${a.assignee ? ` (Assignee: ${a.assignee})` : ''}${a.priority ? ` [${a.priority}]` : ''}${a.due ? ` (Due: ${a.due})` : ''}`)
    })
  }
  return lines.join('\n')
}

export function toMarkdown(session: TranscriptionSession): string {
  const lines: string[] = []
  lines.push(`# ${session.title}`)
  lines.push('')
  lines.push(`> **Type:** ${session.type} · **Language:** ${session.language}${session.source ? ` · **Source:** ${session.source}` : ''}${session.duration ? ` · **Duration:** ${Math.round(session.duration)}s` : ''}`)
  lines.push('')
  if (session.summary) {
    lines.push('## Summary')
    lines.push('')
    lines.push(session.summary)
    lines.push('')
  }
  if (session.actionItems && session.actionItems.length) {
    lines.push('## Action Items')
    lines.push('')
    session.actionItems.forEach((a) => {
      const parts: string[] = []
      if (a.priority) parts.push(`\`[${a.priority.toUpperCase()}]\``)
      parts.push(a.text)
      if (a.assignee) parts.push(`— **@${a.assignee}**`)
      if (a.due) parts.push(`(due ${a.due})`)
      lines.push(`- [ ] ${parts.join(' ')}`)
    })
    lines.push('')
  }
  lines.push('## Transcript')
  lines.push('')
  lines.push(session.transcript || '_(empty)_')
  return lines.join('\n')
}

export function toJson(session: TranscriptionSession): string {
  return JSON.stringify(
    {
      id: session.id,
      title: session.title,
      type: session.type,
      source: session.source,
      language: session.language,
      duration: session.duration,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      transcript: session.transcript,
      segments: session.segments,
      summary: session.summary,
      actionItems: session.actionItems,
    },
    null,
    2
  )
}

export function toSrt(session: TranscriptionSession): string {
  const segs = session.segments && session.segments.length ? session.segments : null
  if (!segs) {
    // No segments — emit a single cue for the whole transcript
    return `1\n${fmtTimestamp(0)} --> ${fmtTimestamp(session.duration || 0)}\n${session.transcript || ''}\n`
  }
  return segs
    .map((s, i) => `${i + 1}\n${fmtTimestamp(s.start)} --> ${fmtTimestamp(s.end)}\n${s.text}\n`)
    .join('\n')
}

export function toNotion(session: TranscriptionSession): string {
  // Notion-friendly markdown with callouts and toggles
  const lines: string[] = []
  lines.push(`# ${session.title}`)
  lines.push('')
  lines.push('> **Type:** ' + session.type + ' · **Language:** ' + session.language)
  if (session.source) lines.push(`> **Source:** ${session.source}`)
  if (session.duration) lines.push(`> **Duration:** ${Math.round(session.duration)}s`)
  lines.push(`> **Created:** ${new Date(session.createdAt).toLocaleString()}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  if (session.summary) {
    lines.push('## 📝 Summary')
    lines.push('')
    lines.push(session.summary)
    lines.push('')
  }
  if (session.actionItems && session.actionItems.length) {
    lines.push('## ✅ Action Items')
    lines.push('')
    session.actionItems.forEach((a) => {
      const tag = a.priority ? ` \`${a.priority.toUpperCase()}\`` : ''
      const who = a.assignee ? ` — @${a.assignee}` : ''
      const due = a.due ? ` · due ${a.due}` : ''
      lines.push(`- [ ] ${a.text}${tag}${who}${due}`)
    })
    lines.push('')
  }
  lines.push('## 🎙 Transcript')
  lines.push('')
  lines.push('<details>')
  lines.push('<summary>Click to expand full transcript</summary>')
  lines.push('')
  lines.push(session.transcript || '_(empty)_')
  lines.push('')
  lines.push('</details>')
  return lines.join('\n')
}

export function toTrello(session: TranscriptionSession): string {
  // Trello doesn't have a native JSON import, but this produces a structured
  // payload that can be pasted into Trello's card-import tools or used by
  // integrations like Zapier. Each action item becomes a checklist item.
  const card = {
    name: session.title,
    desc: session.summary || session.transcript.slice(0, 500),
    labels: session.actionItems
      ?.filter((a) => a.priority)
      .map((a) => ({ name: a.priority })),
    checklist: {
      title: 'Action Items',
      items:
        session.actionItems?.map((a) => ({
          name: `${a.text}${a.assignee ? ` (@${a.assignee})` : ''}${a.due ? ` — due ${a.due}` : ''}`,
          state: 'incomplete',
        })) || [],
    },
    attachments: session.source ? [{ url: session.source, name: session.title }] : [],
    meta: {
      type: session.type,
      language: session.language,
      duration: session.duration,
      createdAt: session.createdAt,
    },
    transcript: session.transcript,
  }
  return JSON.stringify(card, null, 2)
}

export function toJira(session: TranscriptionSession): string {
  // CSV with columns Jira's CSV importer understands.
  const rows: string[] = []
  rows.push(
    ['Summary', 'Description', 'Issue Type', 'Priority', 'Assignee', 'Due Date'].join(',')
  )
  if (session.actionItems && session.actionItems.length) {
    session.actionItems.forEach((a) => {
      const priorityMap: Record<string, string> = {
        high: 'High',
        medium: 'Medium',
        low: 'Low',
      }
      const description = `From: ${session.title}\n${session.summary ? session.summary + '\n' : ''}Action: ${a.text}`
      rows.push(
        [
          escapeCsv(a.text.slice(0, 120)),
          escapeCsv(description),
          escapeCsv('Task'),
          escapeCsv(priorityMap[a.priority || 'medium'] || 'Medium'),
          escapeCsv(a.assignee || ''),
          escapeCsv(a.due || ''),
        ].join(',')
      )
    })
  } else {
    // No action items — create one summary task
    rows.push(
      [
        escapeCsv(session.title),
        escapeCsv(session.summary || session.transcript.slice(0, 500)),
        escapeCsv('Task'),
        escapeCsv('Medium'),
        '',
        '',
      ].join(',')
    )
  }
  return rows.join('\n')
}

export function formatExport(
  format: 'txt' | 'md' | 'json' | 'srt' | 'notion' | 'trello' | 'jira',
  session: TranscriptionSession
): string {
  switch (format) {
    case 'txt':
      return toTxt(session)
    case 'md':
      return toMarkdown(session)
    case 'json':
      return toJson(session)
    case 'srt':
      return toSrt(session)
    case 'notion':
      return toNotion(session)
    case 'trello':
      return toTrello(session)
    case 'jira':
      return toJira(session)
  }
}

export function summarizeActionItems(items: ActionItem[] | null): string {
  if (!items || !items.length) return 'No action items'
  return `${items.length} action item${items.length > 1 ? 's' : ''}`
}
