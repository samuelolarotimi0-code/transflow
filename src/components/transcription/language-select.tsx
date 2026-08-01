'use client'

import { LANGUAGES } from '@/lib/constants'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LanguageSelectProps {
  value: string
  onChange: (value: string) => void
  className?: string
  includeAuto?: boolean
  placeholder?: string
}

export function LanguageSelect({
  value,
  onChange,
  className,
  includeAuto = true,
  placeholder = 'Language',
}: LanguageSelectProps) {
  const langs = includeAuto ? LANGUAGES : LANGUAGES.filter((l) => l.code !== 'auto')

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className} size="sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80 tf-scroll">
        <SelectGroup>
          <SelectLabel>Language</SelectLabel>
          {langs.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              <span className="mr-2">{l.flag}</span>
              <span className="font-medium">{l.nativeLabel}</span>
              {l.label !== l.nativeLabel && (
                <span className="ml-1 text-muted-foreground">· {l.label}</span>
              )}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
