/**
 * Grouping for the event lists.
 *
 * A wrestling season is roughly seventy events: two practice squads twice a
 * week for fourteen weeks, plus a tournament most weekends. A flat list of that
 * length is unreadable, so the public schedule groups by week and the admin
 * list by month.
 *
 * Dates are handled in local time throughout. Using UTC would put a Sunday
 * evening practice in the wrong week for anyone west of Greenwich, which is
 * everyone here.
 */

/** Monday. Practices run midweek, so a Monday start keeps a week intact. */
const WEEK_STARTS_ON = 1

export interface EventPeriod<T> {
  /** Stable key for :key, not shown to anyone. */
  key: string
  label: string
  events: T[]
}

function atMidnight(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function startOfWeek(value: Date): Date {
  const day = atMidnight(value)
  // getDay() is 0 for Sunday, so this maps Sunday back to the previous Monday
  // rather than forward.
  const shift = (day.getDay() - WEEK_STARTS_ON + 7) % 7
  day.setDate(day.getDate() - shift)
  return day
}

function isoKey(value: Date): string {
  const mm = String(value.getMonth() + 1).padStart(2, '0')
  const dd = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${mm}-${dd}`
}

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

/**
 * "This week" and "Next week" are worth naming: they are the two a parent
 * actually acts on, and a bare date makes them do the arithmetic themselves.
 */
export function weekLabel(weekStart: Date, today: Date = new Date()): string {
  const thisWeek = startOfWeek(today)
  const diffDays = Math.round(
    (weekStart.getTime() - thisWeek.getTime()) / 86_400_000,
  )

  if (diffDays === 0) return 'This week'
  if (diffDays === 7) return 'Next week'
  if (diffDays === -7) return 'Last week'

  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  return `${MONTH_DAY.format(weekStart)} \u2013 ${MONTH_DAY.format(end)}`
}

export function monthLabel(value: Date): string {
  return MONTH_YEAR.format(value)
}

/**
 * Groups events into consecutive periods, preserving the incoming order.
 *
 * Order is preserved rather than sorted because the caller has already decided
 * it: the store sorts ascending by date, and the past list is reversed so the
 * most recent comes first.
 */
function groupBy<T>(
  events: T[],
  dateOf: (event: T) => Date,
  keyOf: (date: Date) => string,
  labelOf: (date: Date) => string,
): EventPeriod<T>[] {
  const periods: EventPeriod<T>[] = []
  const byKey = new Map<string, EventPeriod<T>>()

  for (const event of events) {
    const date = dateOf(event)
    const key = keyOf(date)
    let period = byKey.get(key)
    if (!period) {
      period = { key, label: labelOf(date), events: [] }
      byKey.set(key, period)
      periods.push(period)
    }
    period.events.push(event)
  }

  return periods
}

export function groupByWeek<T>(
  events: T[],
  dateOf: (event: T) => Date,
  today: Date = new Date(),
): EventPeriod<T>[] {
  return groupBy(
    events,
    dateOf,
    (date) => isoKey(startOfWeek(date)),
    (date) => weekLabel(startOfWeek(date), today),
  )
}

export function groupByMonth<T>(
  events: T[],
  dateOf: (event: T) => Date,
): EventPeriod<T>[] {
  return groupBy(
    events,
    dateOf,
    (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    (date) => monthLabel(date),
  )
}
