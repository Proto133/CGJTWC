import type { Registration, RegistrationWrestler } from 'src/types'

/**
 * Every wrestler on a registration, whichever shape it was stored in.
 *
 * Submissions made before a family could register together hold a single
 * `wrestler` map; newer ones hold a `wrestlers` array. Callers should never
 * reach for either field directly, or old registrations quietly stop rendering.
 */
export function registrationWrestlers(reg: Registration): RegistrationWrestler[] {
  if (reg.wrestlers?.length) return reg.wrestlers
  return reg.wrestler ? [reg.wrestler] : []
}

/** "Ada Smith, Kit Smith" — for collapsed rows and search. */
export function wrestlerNames(reg: Registration): string {
  return registrationWrestlers(reg)
    .map((w) => `${w.firstName} ${w.lastName}`.trim())
    .join(', ')
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
// Stored as YYYY/MM/DD and shown as MM-DD-YYYY.
//
// The stored form is deliberately not the displayed one: security rules
// validate it with a regex, it sorts correctly as a plain string, and every
// existing record already uses it. Storing the US order instead would make
// 03-04 and 04-03 indistinguishable across a collection holding both.

const STORED = /^(\d{4})\/(\d{2})\/(\d{2})$/
const US = /^(\d{2})-(\d{2})-(\d{4})$/

/** YYYY/MM/DD -> MM-DD-YYYY. Returns the input unchanged if it is not a date. */
export function toUsDate(stored: string | undefined): string {
  if (!stored) return ''
  const m = STORED.exec(stored)
  if (!m) return stored
  const [, year, month, day] = m
  return `${month}-${day}-${year}`
}

/** MM-DD-YYYY -> YYYY/MM/DD. Returns an empty string if it is not a date. */
export function toStoredDate(us: string | undefined): string {
  if (!us) return ''
  const m = US.exec(us)
  if (!m) return ''
  const [, month, day, year] = m
  return `${year}/${month}/${day}`
}

/**
 * Whether a US-formatted string is a real calendar date.
 *
 * A regex alone accepts 02-31-2015, so the parts are round-tripped through
 * Date and compared back. Month is zero-based in the Date constructor.
 */
export function isValidUsDate(us: string): boolean {
  const m = US.exec(us)
  if (!m) return false
  const [, month, day, year] = m
  const monthNum = Number(month)
  const dayNum = Number(day)
  const yearNum = Number(year)

  const date = new Date(yearNum, monthNum - 1, dayNum)
  return (
    date.getFullYear() === yearNum &&
    date.getMonth() === monthNum - 1 &&
    date.getDate() === dayNum
  )
}
