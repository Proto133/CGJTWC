/**
 * MM-DD-YYYY text to and from a native Date.
 *
 * Distinct from the helpers in src/utils/registration.ts, which convert between
 * two *string* forms because registration dates of birth are stored as
 * YYYY/MM/DD text. Events store a Firestore Timestamp, so what is needed here
 * is a Date.
 *
 * The parsing is done from explicit parts rather than by handing the string to
 * `new Date()`, which is not a stylistic choice. `new Date('2026-09-09')` is
 * treated as UTC midnight and comes back as the evening of the 8th anywhere
 * west of Greenwich, which would file every event a day early; and a
 * dash-separated US date is accepted by V8 but is not required to be by the
 * language, so relying on it is luck. Building from parts is unambiguous and
 * always local.
 */

const US = /^(\d{1,2})-(\d{1,2})-(\d{4})$/

/** Date -> "MM-DD-YYYY". */
export function formatUsDate(value: Date): string {
  const mm = String(value.getMonth() + 1).padStart(2, '0')
  const dd = String(value.getDate()).padStart(2, '0')
  return `${mm}-${dd}-${value.getFullYear()}`
}

/**
 * "MM-DD-YYYY" -> local midnight on that day, or null.
 *
 * Round-tripped through Date and compared back, because the regex alone happily
 * accepts 02-31-2026.
 */
export function parseUsDate(input: string | undefined | null): Date | null {
  const match = US.exec((input ?? '').trim())
  if (!match) return null

  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null
  }

  return date
}
