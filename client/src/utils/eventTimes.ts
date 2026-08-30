/**
 * Event times.
 *
 * Times are stored as a wall-clock "HH:MM" in 24-hour form, and deliberately
 * NOT as a UTC instant or with an offset. The season runs September to
 * February and crosses the November DST change, so anything carrying an offset
 * would silently move a 4:15 PM practice by an hour halfway through the year.
 * "HH:MM" also happens to be exactly what Quasar's QTime binds to, and is
 * trivial to validate in security rules with a regex.
 *
 * Three distinct states, mirroring the squad field:
 *   startTime set    -> a timed event
 *   allDay true      -> explicitly all day
 *   neither          -> no time recorded, display nothing
 *
 * Input parsing is liberal because Excel rewrites time cells on save according
 * to locale and cell format, exactly as it does with dates: the same sheet can
 * come back as "4:15 PM", "16:15" or "16:15:00". Being generous here and strict
 * in the import preview beats rejecting a file the admin can see nothing wrong
 * with.
 */

/** Canonical stored form. */
const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

export function isStoredTime(value: string | undefined | null): boolean {
  return typeof value === 'string' && HHMM.test(value)
}

export type TimeParse =
  | { kind: 'blank' }
  | { kind: 'all-day' }
  /** `end` is only ever set when the cell contained a range. */
  | { kind: 'time'; start: string; end?: string }
  /** A 1-12 o'clock value with no AM/PM. Refused rather than guessed. */
  | { kind: 'ambiguous'; raw: string }
  | { kind: 'invalid'; raw: string }

const ALL_DAY_SYNONYMS = ['all day', 'allday', 'all-day', 'anytime', 'tbd', 'tba']

function clean(raw: string | undefined | null): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ')
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

interface Token {
  hour: number
  minute: number
  /** Absent when the token carried no AM/PM. */
  meridiem?: 'am' | 'pm'
}

/**
 * Parses one time token, e.g. "4:15 PM", "4 pm", "16:15", "16:15:00".
 *
 * Seconds are accepted and discarded: Excel writes them when a cell is
 * formatted as a time, and nobody schedules a practice to the second.
 */
function parseToken(value: string): Token | 'ambiguous' | null {
  const withMeridiem = /^(\d{1,2})(?::([0-5]\d))?(?::[0-5]\d)?\s*([ap])\.?\s?m\.?$/i
    .exec(value)

  if (withMeridiem) {
    const hour = Number(withMeridiem[1])
    // 13 PM is a typo, not a time.
    if (hour < 1 || hour > 12) return null
    return {
      hour,
      minute: Number(withMeridiem[2] ?? 0),
      meridiem: withMeridiem[3]!.toLowerCase() === 'a' ? 'am' : 'pm',
    }
  }

  // Minutes are required without a meridiem: a bare "4" is far more likely to
  // be a stray digit than a time.
  const bare = /^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/.exec(value)
  if (!bare) return null

  const hour = Number(bare[1])
  const minute = Number(bare[2])
  if (hour > 23) return null

  // 1:00 through 12:59 could be either half of the day. 13:00+ and 00:xx can
  // only be 24-hour, so they are taken at face value.
  if (hour >= 1 && hour <= 12) return 'ambiguous'

  return { hour, minute }
}

function toStored(token: Token): string {
  let hour = token.hour
  if (token.meridiem === 'pm' && hour < 12) hour += 12
  if (token.meridiem === 'am' && hour === 12) hour = 0
  return `${pad(hour)}:${pad(token.minute)}`
}

function minutesOf(stored: string): number {
  const [h, m] = stored.split(':').map(Number)
  return h! * 60 + m!
}

/**
 * Parses a cell that may hold a single time, an "All Day" marker, or a range.
 *
 * Ranges are supported because the club's own template wrote practice slots as
 * "4:15-5:15", so their existing habit keeps working instead of becoming an
 * error they have to learn about.
 */
export function parseTimeCell(raw: string | undefined | null): TimeParse {
  const value = clean(raw)
  if (value === '') return { kind: 'blank' }
  if (ALL_DAY_SYNONYMS.includes(value.toLowerCase())) return { kind: 'all-day' }

  // Split on a dash or "to", but only when it separates two time-ish halves;
  // an en or em dash turns up when a spreadsheet autocorrects a hyphen.
  const rangeParts = value.split(/\s*(?:-|\u2013|\u2014|\bto\b)\s*/i)
    .filter((part) => part !== '')

  if (rangeParts.length > 2) return { kind: 'invalid', raw: value }

  if (rangeParts.length === 2) {
    return parseRange(rangeParts[0]!, rangeParts[1]!, value)
  }

  const token = parseToken(value)
  if (token === 'ambiguous') return { kind: 'ambiguous', raw: value }
  if (!token) return { kind: 'invalid', raw: value }
  return { kind: 'time', start: toStored(token) }
}

function parseRange(rawStart: string, rawEnd: string, whole: string): TimeParse {
  let startToken = parseToken(rawStart)
  let endToken = parseToken(rawEnd)

  if (!startToken || !endToken) return { kind: 'invalid', raw: whole }

  // "4:15-5:15 PM": the meridiem is written once, at the end, and applies
  // backwards to the start as well.
  if (startToken === 'ambiguous' && endToken !== 'ambiguous' && endToken.meridiem) {
    const retry = parseToken(`${rawStart} ${endToken.meridiem}`)
    if (retry && retry !== 'ambiguous') startToken = retry
  }

  // "6:00 PM - 7:30": only the start carries a meridiem, so the end inherits
  // it. Tracked, because an inherited meridiem may still need flipping below
  // while an explicitly written one must be left exactly as the admin typed it.
  let endInherited = false
  if (endToken === 'ambiguous' && startToken !== 'ambiguous' && startToken.meridiem) {
    const inherited = parseToken(`${rawEnd} ${startToken.meridiem}`)
    if (inherited && inherited !== 'ambiguous') {
      endToken = inherited
      endInherited = true
    }
  }

  if (startToken === 'ambiguous' || endToken === 'ambiguous') {
    return { kind: 'ambiguous', raw: whole }
  }

  const start = toStored(startToken)
  let end = toStored(endToken)

  /*
   * "11:30 AM - 1:00": the end inherited AM, which would put it before the
   * start. Flipping is sound reasoning rather than a guess about this club,
   * because an event cannot end before it begins. Only ever applied to an
   * inherited meridiem.
   */
  if (endInherited && minutesOf(end) <= minutesOf(start)) {
    const flipped = parseToken(
      `${rawEnd} ${startToken.meridiem === 'pm' ? 'am' : 'pm'}`,
    )
    if (flipped && flipped !== 'ambiguous') {
      const candidate = toStored(flipped)
      if (minutesOf(candidate) > minutesOf(start)) end = candidate
    }
  }

  return { kind: 'time', start, end }
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** "16:15" -> "4:15 PM". Returns '' for anything not in stored form. */
export function formatTime(stored: string | undefined | null): string {
  if (!isStoredTime(stored)) return ''
  const [h, m] = stored!.split(':').map(Number)
  const meridiem = h! < 12 ? 'AM' : 'PM'
  const hour12 = h! % 12 === 0 ? 12 : h! % 12
  return `${hour12}:${pad(m!)} ${meridiem}`
}

export interface TimeFields {
  startTime?: string | undefined
  endTime?: string | undefined
  allDay?: boolean | undefined
  /** @deprecated Legacy free-text time on documents written before the split. */
  time?: string | undefined
}

/**
 * The single place that decides how an event's time reads.
 *
 * Falls back to the deprecated free-text field so documents written before the
 * split still display, which is what lets this ship without a data migration.
 */
export function formatEventTime(event: TimeFields): string {
  if (event.allDay) return 'All Day'

  const start = isStoredTime(event.startTime) ? event.startTime! : ''
  const end = isStoredTime(event.endTime) ? event.endTime! : ''

  if (start && end) {
    const startMeridiem = Number(start.split(':')[0]) < 12 ? 'AM' : 'PM'
    const endMeridiem = Number(end.split(':')[0]) < 12 ? 'AM' : 'PM'
    // "4:15 – 5:15 PM" rather than "4:15 PM – 5:15 PM" when both sit in the
    // same half of the day, which is the usual case for a practice slot.
    const startText = startMeridiem === endMeridiem
      ? formatTime(start).replace(` ${startMeridiem}`, '')
      : formatTime(start)
    return `${startText} \u2013 ${formatTime(end)}`
  }

  if (start) return formatTime(start)

  return (event.time ?? '').trim()
}

/**
 * Sort key for ordering events within a single day.
 *
 * Needed because Firestore's orderBy('date') gives no tie-break, and with two
 * squads practising twice a week most days hold more than one event, so their
 * order was previously undefined. All-day events lead the day, timed events
 * follow in order, and anything with no time recorded sits at the end.
 */
export function startMinutes(event: TimeFields): number {
  if (event.allDay) return -1
  if (isStoredTime(event.startTime)) return minutesOf(event.startTime!)
  return Number.MAX_SAFE_INTEGER
}
