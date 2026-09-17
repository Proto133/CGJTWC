import type {
  Registration,
  RegistrationWrestler,
  Wrestler,
  WrestlerPrivate,
} from 'src/types'
import { ikwfDivision } from 'src/utils/season'

/**
 * Turning a registration into a roster entry.
 *
 * Kept pure and separate from the dialog so the mapping can be exercised
 * directly. The mapping is the part worth being careful about: a registration
 * is a snapshot of one signup, a wrestler record outlives seasons, and the
 * admin screens actively encourage deleting registrations once a family is
 * enrolled. Anything this does not carry across is lost at that point.
 */

export interface ConversionDraft {
  pub: Omit<Wrestler, 'id' | 'createdAt' | 'updatedAt'>
  priv: WrestlerPrivate
}

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

/**
 * Answers with nowhere of their own to live.
 *
 * Experience and previous club are real signal for a coach placing a new
 * wrestler, and they only exist on the registration. Folding them into notes
 * is not elegant, but the alternative is that they vanish the first time an
 * admin follows the advice on the registrations screen and deletes the
 * submission.
 */
export function carriedNotes(w: RegistrationWrestler): string {
  const lines: string[] = []
  if (clean(w.yearsExperience)) lines.push(`Experience at signup: ${clean(w.yearsExperience)}`)
  if (clean(w.previousClub)) lines.push(`Previous club: ${clean(w.previousClub)}`)
  return lines.join('\n')
}

/**
 * What would be written for this child.
 *
 * Division is derived rather than copied: it is a function of the date of birth
 * and the season and moves on its own each year. It is left unset when the date
 * of birth puts the wrestler outside IKWF's bands, so an aged-out registrant
 * shows as having no division rather than being quietly filed as a Senior.
 *
 * `published` is false regardless. Appearing on the public site is a separate
 * decision from being on the roster, and defaulting it the other way would put
 * a child's name on a public page as a side effect of an admin filing paperwork.
 */
export function draftFromRegistrant(
  reg: Registration,
  w: RegistrationWrestler,
  season: string,
): ConversionDraft {
  const division = ikwfDivision(w.dob, season)
  const guardian = `${clean(reg.guardian?.firstName)} ${clean(reg.guardian?.lastName)}`.trim()
  const notes = carriedNotes(w)

  return {
    pub: {
      firstName: clean(w.firstName),
      lastName: clean(w.lastName),
      season,
      active: true,
      published: false,
      ...(division ? { division } : {}),
    },
    // Empty values are dropped rather than written as '': this half is not key
    // whitelisted by the rules, so nothing stops a blank field being stored,
    // and a record full of empty strings reads as answered-and-blank.
    priv: {
      ...(clean(w.dob) ? { dob: clean(w.dob) } : {}),
      ...(clean(w.grade) ? { grade: clean(w.grade) } : {}),
      ...(clean(w.usawNumber) ? { usawNumber: clean(w.usawNumber) } : {}),
      ...(guardian ? { guardianName: guardian } : {}),
      ...(clean(reg.guardian?.email) ? { guardianEmail: clean(reg.guardian.email) } : {}),
      ...(clean(reg.guardian?.phone) ? { guardianPhone: clean(reg.guardian.phone) } : {}),
      ...(clean(reg.emergency?.name) ? { emergencyName: clean(reg.emergency.name) } : {}),
      ...(clean(reg.emergency?.phone) ? { emergencyPhone: clean(reg.emergency.phone) } : {}),
      ...(clean(reg.emergency?.relationship)
        ? { emergencyRelationship: clean(reg.emergency.relationship) } : {}),
      ...(notes ? { notes } : {}),
      sourceRegistrationId: reg.id,
    },
  }
}

/**
 * Roster entries that could be this child.
 *
 * Name only, deliberately. The date of birth is the thing that actually settles
 * it, but it lives in each wrestler's private subcollection and fetching every
 * one of those to answer "is this child already here" would read the whole
 * roster's personal data on every glance. So the name narrows it to the handful
 * worth fetching, and the caller checks dates of birth on those.
 */
export function nameMatches(roster: Wrestler[], w: RegistrationWrestler): Wrestler[] {
  const first = clean(w.firstName).toLowerCase()
  const last = clean(w.lastName).toLowerCase()
  if (!first || !last) return []

  return roster.filter((r) =>
    r.firstName.trim().toLowerCase() === first
    && r.lastName.trim().toLowerCase() === last)
}

export type MatchVerdict =
  /** Same name, same date of birth. Treat as the same child. */
  | 'sameChild'
  /** Same name, a different date of birth. A namesake, or a typo. */
  | 'sameName'
  /** Same name and we cannot tell, because one side has no date of birth. */
  | 'unknown'

export function compareDob(
  registrantDob: string | undefined,
  existingDob: string | undefined,
): MatchVerdict {
  const a = clean(registrantDob)
  const b = clean(existingDob)
  if (!a || !b) return 'unknown'
  return a === b ? 'sameChild' : 'sameName'
}
