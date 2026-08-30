import type { Event, EventFormPayload, EventType } from 'src/types'
import { ALL_GROUPS, cleanGroup, isAllGroups } from 'src/utils/eventGroups'
import { formatTime, parseTimeCell } from 'src/utils/eventTimes'

/**
 * Bulk event import from a spreadsheet.
 *
 * CSV rather than xlsx on purpose. Parsing xlsx needs a heavyweight dependency,
 * and the usual one (SheetJS) ships current releases outside npm while the npm
 * build is stale with known advisories. Excel and Google Sheets both open and
 * save CSV, and Excel keeps the .csv extension on Save. An admin who uses
 * "Save As" and picks xlsx is caught explicitly in `parseEventsCsv` rather than
 * being shown a confusing parse failure.
 *
 * There is deliberately no id column: editing existing events happens through
 * the bulk field editor, not by round-tripping a spreadsheet.
 */

export const EVENT_TYPES: EventType[] = ['practice', 'dual', 'tournament', 'other']

interface ColumnSpec {
  key: keyof EventCsvRecord
  /** Written to generated files, and matched on import. */
  header: string
  /**
   * Other spellings accepted on import, lower-cased.
   *
   * The club's own template uses the long forms, and a shorter set is accepted
   * too so a hand-made sheet also works. Matching by header rather than by
   * position means column order in the uploaded file does not matter.
   */
  aliases: string[]
  required: boolean
  /** Shown in the import dialog, so the columns are documented in one place. */
  hint: string
}

/** Order matches Events_Template.csv, so an export lines up with the template. */
export const EVENT_COLUMNS: ColumnSpec[] = [
  {
    key: 'title',
    header: 'Event Title',
    aliases: ['title'],
    required: true,
    hint: 'Dual vs Cary-Grove',
  },
  {
    key: 'date',
    header: 'Date',
    aliases: ['event date'],
    required: true,
    hint: '09/09/26 or 09-09-2026',
  },
  {
    key: 'startTime',
    header: 'Start Time',
    // 'time' is kept so a sheet built from the older single-column template
    // still imports; a range such as "4:15-5:15 PM" in that one cell is split
    // into both fields.
    aliases: ['time', 'start', 'from', 'begins'],
    required: false,
    hint: '4:15 PM, or 16:15. Write All Day for an all-day event',
  },
  {
    key: 'endTime',
    header: 'End Time',
    aliases: ['end', 'to', 'finish', 'ends'],
    required: false,
    hint: '5:15 PM. Leave blank if there is no set finish',
  },
  {
    key: 'location',
    header: 'Location/Venue',
    aliases: ['location', 'venue'],
    required: true,
    hint: 'Cary Grove High School',
  },
  {
    key: 'type',
    header: 'Event Type',
    aliases: ['type'],
    required: true,
    hint: EVENT_TYPES.join(' / '),
  },
  {
    key: 'group',
    header: 'Group (TBI/NS)',
    // Generous, because this column was added to the club's template after the
    // importer was written and the wording may yet be shortened.
    aliases: [
      'group',
      'age group',
      'division',
      'squad',
      'group(tbi/ns)',
      'tbi/ns',
    ],
    required: false,
    hint: 'TBI, NS, or ALL for both. Leave blank to badge no squad',
  },
  {
    key: 'opponent',
    header: 'Opponent (if applicable)',
    aliases: ['opponent'],
    required: false,
    hint: 'Cary-Grove',
  },
  {
    key: 'description',
    header: 'Description/Notes',
    aliases: ['description', 'notes'],
    required: false,
    hint: 'Optional notes',
  },
]

interface EventCsvRecord {
  title: string
  date: string
  startTime: string
  endTime: string
  type: string
  location: string
  group: string
  opponent: string
  description: string
}

export interface ParsedEventRow {
  /** 1-based row number as the admin sees it in their spreadsheet. */
  rowNumber: number
  raw: EventCsvRecord
  /** Null when the row has errors. */
  payload: EventFormPayload | null
  errors: string[]
  /** Title of an existing event on the same date, if any. */
  duplicateOf: string | null
  /** A demonstration row shipped in the template, never imported. */
  isExample: boolean
}

/**
 * The worked examples in the club's template.
 *
 * They parse as perfectly valid events, so without this an admin who fills in
 * their own rows but forgets to delete the examples imports two fictional
 * events. The preview would show them, but people skim.
 *
 * Matched on title and the example blurb. Deliberately not on the date, which
 * is being changed from two-digit to four-digit years, nor on location or time,
 * which are the fields most likely to be tweaked in a future template.
 *
 * The blurb is looked for in either the description or the opponent cell.
 * Inserting the Group column into the template once shifted the header row
 * without shifting the example rows beneath it, which left the blurb in
 * Opponent. That file has been corrected, but an admin may still have an older
 * copy saved locally, and checking both cells costs nothing.
 */
const TEMPLATE_EXAMPLES: { title: string; blurb: string }[] = [
  { title: 'tournament a', blurb: 'this is an example tournament' },
  { title: 'practice young', blurb: 'this is an example of a practice event' },
  { title: 'practice older', blurb: 'this is an example of a practice event' },
]

/** Lower-cased, trimmed, internal whitespace collapsed. */
function normaliseText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isTemplateExample(record: EventCsvRecord): boolean {
  const title = normaliseText(record.title)
  const description = normaliseText(record.description)
  const opponent = normaliseText(record.opponent)
  return TEMPLATE_EXAMPLES.some(
    (example) =>
      example.title === title
      && (example.blurb === description || example.blurb === opponent),
  )
}

export interface ParseResult {
  rows: ParsedEventRow[]
  /** Set when the whole file is unusable, e.g. wrong format or no header. */
  fatalError: string | null
  /**
   * Header cells that matched no known column, so their data was ignored.
   *
   * Surfaced rather than dropped silently: a renamed or misspelled header would
   * otherwise mean a whole column of data quietly never arrives, and the import
   * would look like it worked.
   */
  unknownColumns: string[]
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/**
 * A headers-only fallback template, generated from EVENT_COLUMNS so it cannot
 * drift out of step with the parser.
 *
 * The club's own Events_Template.csv, served from public/templates, is what the
 * dialog offers first; it includes worked examples. This exists so there is
 * always a template that provably matches the importer.
 *
 * The BOM matters. Without it Excel reads the file as the system codepage and
 * mangles anything non-ASCII in a venue or opponent name.
 */
export function buildEventsTemplateCsv(): string {
  return '\uFEFF' + EVENT_COLUMNS.map((c) => c.header).join(',') + '\r\n'
}

/** Exports current events in the same shape, for reference or as a backup. */
export function buildEventsExportCsv(events: Event[]): string {
  const header = EVENT_COLUMNS.map((c) => c.header).join(',')
  const lines = events.map((event) => {
    const record: EventCsvRecord = {
      title: event.title,
      date: formatUsDate(event.date.toDate()),
      // Written back in the readable form the template asks for, so an export
      // can be edited and re-imported unchanged.
      startTime: event.allDay
        ? 'All Day'
        : (formatTime(event.startTime) || event.time || ''),
      endTime: event.allDay ? '' : formatTime(event.endTime),
      type: event.type,
      location: event.location,
      group: event.group ?? '',
      opponent: event.opponent ?? '',
      description: event.description ?? '',
    }
    return EVENT_COLUMNS.map((c) => escapeCsv(record[c.key])).join(',')
  })

  return '\uFEFF' + [header, ...lines].join('\r\n') + '\r\n'
}

function escapeCsv(value: string): string {
  // Quote whenever the value could otherwise break the row, and double any
  // embedded quote, per RFC 4180.
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function formatUsDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${mm}-${dd}-${date.getFullYear()}`
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Splits CSV text into rows of fields.
 *
 * Hand-rolled rather than pulled from a dependency: the whole grammar is
 * quotes, doubled quotes and separators. Handles fields containing commas and
 * newlines, and treats CRLF, CR and LF alike, because a file may have been
 * touched by Excel on Windows, Sheets, or a Mac.
 */
function splitCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      i += 1
      continue
    }

    if (char === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }

    if (char === '\r' || char === '\n') {
      // Consume CRLF as one break.
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }

    field += char
    i += 1
  }

  // Whatever is left is the last field, unless the file ended with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/**
 * Accepts the formats Excel and Sheets actually produce.
 *
 * MM-DD-YYYY is what the template asks for and what the rest of the admin UI
 * uses, but Excel rewrites dates according to the machine's locale on save, so
 * slashes, single-digit months and ISO all turn up in real files. Being liberal
 * here and strict in the preview is better than rejecting a file an admin
 * cannot see anything wrong with.
 */
function parseDate(input: string): Date | null {
  const value = input.trim()
  if (value === '') return null

  let year: number | undefined
  let month: number | undefined
  let day: number | undefined

  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value)
  // Two-digit years are what the club's template actually contains (09/09/26),
  // and what Excel tends to write back, so they are accepted rather than
  // rejected as malformed.
  const us = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/.exec(value)

  if (iso) {
    year = Number(iso[1])
    month = Number(iso[2])
    day = Number(iso[3])
  } else if (us) {
    month = Number(us[1])
    day = Number(us[2])
    year = expandYear(us[3]!)
  } else {
    return null
  }

  const date = new Date(year, month - 1, day)
  // Round-trip check: rejects 02-31-2026, which the regex alone accepts.
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null
  }

  return date
}

/**
 * Expands a two-digit year.
 *
 * Under 70 is treated as 2000s. A wrestling schedule is always in the current
 * century, so the pivot only exists to keep the function honest rather than to
 * serve a real case.
 */
function expandYear(raw: string): number {
  const value = Number(raw)
  if (raw.length === 4) return value
  return value < 70 ? 2000 + value : 1900 + value
}

/** Header matching is case and whitespace insensitive. */
function normaliseHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\uFEFF/g, '')
}

/**
 * An xlsx file is a zip archive, so it starts with the local file header
 * signature "PK\x03\x04". Detecting it lets us say something useful instead of
 * showing the admin a wall of binary as failed rows.
 */
export function looksLikeXlsx(text: string): boolean {
  // Strict signature only. A bare "PK" prefix would also match a legitimate CSV
  // whose first cell happened to start with those letters.
  return text.startsWith('PK\u0003\u0004')
}

export function parseEventsCsv(text: string, existing: Event[]): ParseResult {
  if (looksLikeXlsx(text)) {
    return {
      rows: [],
      unknownColumns: [],
      fatalError:
        'That looks like an Excel workbook (.xlsx) rather than a CSV. In Excel, '
        + 'use File \u2192 Save As and choose "CSV UTF-8 (Comma delimited)", then '
        + 'upload the .csv file.',
    }
  }

  const grid = splitCsv(text).filter((row) => row.some((cell) => cell.trim() !== ''))

  if (grid.length === 0) {
    return { rows: [], fatalError: 'That file is empty.', unknownColumns: [] }
  }

  const headerRow = grid[0]!.map(normaliseHeader)
  const indexOf = new Map<string, number>()
  const matchedIndexes = new Set<number>()
  for (const column of EVENT_COLUMNS) {
    const candidates = [column.header.toLowerCase(), ...column.aliases]
    const index = headerRow.findIndex(
      (cell, i) => !matchedIndexes.has(i) && candidates.includes(cell),
    )
    if (index >= 0) {
      indexOf.set(column.key, index)
      matchedIndexes.add(index)
    }
  }

  // Reported from the original header row, not the normalised one, so the admin
  // sees the text exactly as it appears in their spreadsheet.
  const unknownColumns = grid[0]!
    .map((cell, i) => ({ cell: cell.trim(), i }))
    .filter(({ cell, i }) => cell !== '' && !matchedIndexes.has(i))
    .map(({ cell }) => cell)

  const missingRequired = EVENT_COLUMNS
    .filter((c) => c.required && !indexOf.has(c.key))
    .map((c) => c.header)

  if (missingRequired.length > 0) {
    return {
      rows: [],
      unknownColumns,
      fatalError:
        `The header row is missing: ${missingRequired.join(', ')}. `
        + 'Download the template and paste your rows under its headers.',
    }
  }

  // An existing event is "the same" if it shares a title and a calendar day.
  // Matching on the day rather than the exact timestamp because the sheet has
  // no seconds, and a re-import would otherwise never look like a duplicate.
  const existingKeys = new Map<string, string>()
  for (const event of existing) {
    existingKeys.set(duplicateKey(event.title, event.date.toDate()), event.title)
  }

  const rows: ParsedEventRow[] = []

  for (let r = 1; r < grid.length; r += 1) {
    const cells = grid[r]!
    const cell = (key: keyof EventCsvRecord) => {
      const index = indexOf.get(key)
      return index === undefined ? '' : (cells[index] ?? '').trim()
    }

    const raw: EventCsvRecord = {
      title: cell('title'),
      date: cell('date'),
      startTime: cell('startTime'),
      endTime: cell('endTime'),
      type: cell('type'),
      location: cell('location'),
      group: cell('group'),
      opponent: cell('opponent'),
      description: cell('description'),
    }

    const errors: string[] = []

    if (raw.title === '') errors.push('Title is required')
    if (raw.location === '') errors.push('Location is required')

    const date = parseDate(raw.date)
    if (raw.date === '') errors.push('Date is required')
    else if (!date) {
      errors.push(
        `Date "${raw.date}" is not a valid date. Use MM-DD-YYYY, MM/DD/YY or YYYY-MM-DD.`,
      )
    }

    const type = raw.type.trim().toLowerCase() as EventType
    if (raw.type === '') errors.push('Type is required')
    else if (!EVENT_TYPES.includes(type)) {
      errors.push(`Type "${raw.type}" must be one of ${EVENT_TYPES.join(', ')}`)
    }

    const groupValue = isAllGroups(raw.group) ? ALL_GROUPS : cleanGroup(raw.group)
    const times = resolveTimes(raw.startTime, raw.endTime)
    errors.push(...times.errors)

    const duplicateOf = date
      ? (existingKeys.get(duplicateKey(raw.title, date)) ?? null)
      : null

    rows.push({
      // +1 again so the number matches the spreadsheet, where row 1 is headers.
      rowNumber: r + 1,
      raw,
      errors,
      duplicateOf,
      isExample: isTemplateExample(raw),
      payload: errors.length === 0 && date
        ? {
            title: raw.title,
            date,
            type,
            location: raw.location,
            ...(times.allDay ? { allDay: true } : {}),
            ...(times.startTime ? { startTime: times.startTime } : {}),
            ...(times.endTime ? { endTime: times.endTime } : {}),
            // Canonicalised so "both" or "any" in a hand-filled sheet does not
            // become a squad name of its own in the filters.
            ...(groupValue ? { group: groupValue } : {}),
            ...(raw.opponent ? { opponent: raw.opponent } : {}),
            ...(raw.description ? { description: raw.description } : {}),
          }
        : null,
    })
  }

  if (rows.length === 0) {
    return {
      rows: [],
      unknownColumns,
      fatalError: 'That file has headers but no event rows.',
    }
  }

  return { rows, fatalError: null, unknownColumns }
}

function duplicateKey(title: string, date: Date): string {
  return `${title.trim().toLowerCase()}|${formatUsDate(date)}`
}

interface ResolvedTimes {
  startTime: string
  endTime: string
  allDay: boolean
  errors: string[]
}

/**
 * Turns the two spreadsheet time cells into stored fields.
 *
 * An ambiguous value is refused rather than guessed. "4:15" is a perfectly
 * reasonable thing to type and could mean either half of the day, and a
 * practice silently scheduled for 4:15 in the morning is worse than a row the
 * admin has to correct — the preview lists every offending row at once, so one
 * find-and-replace fixes a whole season.
 */
function resolveTimes(startCell: string, endCell: string): ResolvedTimes {
  const errors: string[] = []
  const start = parseTimeCell(startCell)
  const end = parseTimeCell(endCell)

  const complain = (label: string, parsed: typeof start) => {
    if (parsed.kind === 'ambiguous') {
      errors.push(
        `${label} "${parsed.raw}" needs AM or PM, or write it in 24-hour form `
        + '(16:15)',
      )
    } else if (parsed.kind === 'invalid') {
      errors.push(
        `${label} "${parsed.raw}" is not a time. Use 4:15 PM, 16:15, or All Day.`,
      )
    }
  }

  complain('Start time', start)
  complain('End time', end)

  // "All Day" in either cell settles it, and any times are then irrelevant.
  if (start.kind === 'all-day' || end.kind === 'all-day') {
    return { startTime: '', endTime: '', allDay: true, errors }
  }

  const startTime = start.kind === 'time' ? start.start : ''
  // The End Time column wins over an end implied by a range in the start cell,
  // on the grounds that the explicit column is the more deliberate statement.
  const endTime = end.kind === 'time'
    ? end.start
    : (start.kind === 'time' ? (start.end ?? '') : '')

  if (startTime && endTime && endTime <= startTime) {
    // String comparison is safe: zero-padded 24-hour values sort as times.
    errors.push(
      `End time ${formatTime(endTime)} is not after the start time `
      + `${formatTime(startTime)}`,
    )
  }

  if (!startTime && endTime) {
    errors.push('There is an end time but no start time')
  }

  return { startTime, endTime, allDay: false, errors }
}

/** Triggers a download without needing a server or an anchor in the template. */
export function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Without this the blob is retained for the lifetime of the document.
  URL.revokeObjectURL(url)
}
