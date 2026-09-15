import type { IkwfDivision } from 'src/types'
import { parseStoredDate } from 'src/utils/usDate'

/**
 * Seasons and IKWF age divisions.
 *
 * A division is a function of the wrestler's date of birth and the season, not
 * something anyone maintains by hand, and it moves on its own each year. That
 * is a large part of why a wrestler record outlives a single season.
 */

/**
 * The IKWF year runs 1 September to 31 August, so a season is labelled by the
 * calendar year it starts in: '2026-27'.
 */
export function currentSeason(now: Date = new Date()): string {
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

/** The 31 December a season's ages are reckoned on. */
function ageCutoff(season: string): Date | null {
  const startYear = Number(season.slice(0, 4))
  if (!Number.isFinite(startYear)) return null
  return new Date(startYear, 11, 31)
}

/** Age on 31 December of the season, which is the only age IKWF cares about. */
export function ikwfAge(dob: string | undefined, season: string): number | null {
  const born = parseStoredDate(dob)
  const cutoff = ageCutoff(season)
  if (!born || !cutoff) return null

  let age = cutoff.getFullYear() - born.getFullYear()
  const monthDiff = cutoff.getMonth() - born.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && cutoff.getDate() < born.getDate())) age -= 1
  return age
}

/**
 * Tot at six and under, Bantam seven and eight, Intermediate nine and ten,
 * Novice eleven and twelve, Senior thirteen and fourteen.
 *
 * Over fourteen returns null rather than Senior: that wrestler has aged out of
 * IKWF, and quietly filing them as Senior would hide it.
 */
export function ikwfDivision(
  dob: string | undefined,
  season: string,
): IkwfDivision | null {
  const age = ikwfAge(dob, season)
  if (age === null || age < 0) return null
  if (age <= 6) return 'tot'
  if (age <= 8) return 'bantam'
  if (age <= 10) return 'intermediate'
  if (age <= 12) return 'novice'
  if (age <= 14) return 'senior'
  return null
}

const DIVISION_LABELS: Record<IkwfDivision, string> = {
  tot: 'Tot',
  bantam: 'Bantam',
  intermediate: 'Intermediate',
  novice: 'Novice',
  senior: 'Senior',
}

export function divisionLabel(division: IkwfDivision | undefined | null): string {
  return division ? DIVISION_LABELS[division] : ''
}

/**
 * The practice squad a division belongs to.
 *
 * TBI and NS are the groups already used on events, so the squad a wrestler
 * practises with falls out of the same date of birth. Note the line sits
 * between ten and eleven by IKWF reckoning.
 */
export function squadForDivision(division: IkwfDivision | null): 'TBI' | 'NS' | null {
  if (!division) return null
  return division === 'novice' || division === 'senior' ? 'NS' : 'TBI'
}
