/**
 * Squad grouping for events.
 *
 * The club runs two practice squads, TBI (Tot/Bantam/Intermediate) and NS
 * (Novice/Senior), and an event may belong to one, to both, or to neither.
 * Three spellings, three distinct meanings:
 *
 *   "TBI"  -> that squad only, badged TBI
 *   "ALL"  -> both squads, badged TBI and NS
 *   blank  -> no squad recorded, no badge at all
 *
 * ALL and blank are deliberately not the same thing. ALL is a positive claim
 * that both squads attend, which is worth showing on the card; blank only says
 * nobody filled the column in.
 *
 * The field is free text rather than an enum because the club's own naming was
 * still settling when it was added, and the squad list is derived from the
 * values actually in use, so renaming a squad needs no migration.
 */

/** Ways of writing "both squads" that turn up in a hand-filled sheet. */
const ALL_SYNONYMS = ['all', 'both', 'any', 'everyone', 'all groups', 'all squads']

/**
 * What ALL expands to before any squad-specific event exists.
 *
 * A seed, not a schema: as soon as real events carry squad values, those are
 * what ALL expands to. Without this an ALL-only schedule would badge nothing,
 * which would look like the field had been ignored.
 */
const SEED_SQUADS = ['TBI', 'NS']

/** The canonical spelling written to exports and offered in the admin forms. */
export const ALL_GROUPS = 'ALL'

/** Trimmed, internal whitespace collapsed. Casing is left alone. */
export function cleanGroup(raw: string | undefined | null): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ')
}

export function isAllGroups(raw: string | undefined | null): boolean {
  return ALL_SYNONYMS.includes(cleanGroup(raw).toLowerCase())
}

export function hasNoGroup(raw: string | undefined | null): boolean {
  return cleanGroup(raw) === ''
}

/**
 * The distinct squad names in use, excluding ALL and blank.
 *
 * Deduped case-insensitively, keeping the first spelling seen, so a stray
 * "tbi" in one row does not produce a second chip alongside "TBI".
 */
export function squadsInUse(events: { group?: string }[]): string[] {
  const seen = new Map<string, string>()
  for (const event of events) {
    const value = cleanGroup(event.group)
    if (value === '' || isAllGroups(value)) continue
    const key = value.toLowerCase()
    if (!seen.has(key)) seen.set(key, value)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

/**
 * The squads an event should be badged with.
 *
 * `known` comes from `squadsInUse` over the whole schedule, which is what lets
 * ALL expand to the squads the club actually runs rather than to a hardcoded
 * pair.
 */
export function eventSquads(
  group: string | undefined,
  known: string[] = [],
): string[] {
  const value = cleanGroup(group)
  if (value === '') return []

  if (!isAllGroups(value)) {
    // Badged with the spelling the rest of the schedule uses, so a stray "ns"
    // in one imported row does not read differently from the NS filter chip.
    const canonical = known.find((squad) => squad.toLowerCase() === value.toLowerCase())
    return [canonical ?? value]
  }

  return known.length > 0 ? [...known] : [...SEED_SQUADS]
}

/**
 * Whether an event survives a squad filter.
 *
 * An empty selection means no filtering. An event with no squad recorded is
 * always kept: the column being blank is not evidence that the event belongs to
 * somebody else, and hiding a tournament from a parent who filtered to their
 * child's squad is a worse failure than showing one extra row.
 */
export function matchesGroupFilter(
  group: string | undefined,
  selected: string[],
  known: string[] = [],
): boolean {
  if (selected.length === 0) return true

  const squads = eventSquads(group, known)
  if (squads.length === 0) return true

  const wanted = new Set(selected.map((s) => s.toLowerCase()))
  return squads.some((squad) => wanted.has(squad.toLowerCase()))
}
