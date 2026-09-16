import type { Match, MatchEventType, MatchWinType } from 'src/types'

/**
 * How match data reads on screen.
 *
 * Kept out of matchScoring.ts, which is deliberately rules and derivation with
 * nothing presentational in it, and out of wrestlerStats.ts, which is about
 * season totals. Three screens now render the same calls — the scoring
 * buttons, the running tape and the box score — and a second copy of these
 * strings is a second place for them to drift.
 */

/**
 * Mat shorthand, for buttons and the tape where there is no room for words.
 *
 * These are what a scorer says out loud, not descriptions: there is no time to
 * read "near fall, three points" between scrambles.
 */
const EVENT_LABELS: Record<MatchEventType, string> = {
  takedown: 'T',
  escape: 'E',
  reversal: 'R',
  nearFall2: 'N2',
  nearFall3: 'N3',
  nearFall4: 'N4',
  penalty1: 'P1',
  penalty2: 'P2',
  stallWarning: 'SW',
  stallPoint: 'S1',
  stallPoint2: 'S2',
  stallDq: 'DQ',
  caution: 'C',
  cautionPoint: 'C1',
}

/** Full names, for the box score, where being unambiguous matters more. */
const EVENT_NAMES: Record<MatchEventType, string> = {
  takedown: 'Takedown',
  escape: 'Escape',
  reversal: 'Reversal',
  nearFall2: 'Near fall, 2',
  nearFall3: 'Near fall, 3',
  nearFall4: 'Near fall, 4',
  penalty1: 'Penalty, 1',
  penalty2: 'Penalty, 2',
  stallWarning: 'Stalling warning',
  stallPoint: 'Stalling, 1',
  stallPoint2: 'Stalling, 2',
  stallDq: 'Stalling, disqualification',
  caution: 'Caution',
  cautionPoint: 'Caution, 1',
}

export function eventLabel(type: MatchEventType): string {
  return EVENT_LABELS[type] ?? type
}

export function eventName(type: MatchEventType): string {
  return EVENT_NAMES[type] ?? type
}

/** Short display labels, for bout lists where a line has to fit. */
const WIN_TYPE_LABELS: Record<MatchWinType, string> = {
  decision: 'Decision',
  majorDecision: 'Major',
  techFall: 'Tech fall',
  fall: 'Pin',
  forfeit: 'Forfeit',
  injuryDefault: 'Injury default',
  disqualification: 'DQ',
  bye: 'Bye',
}

export function winTypeLabel(winType: MatchWinType): string {
  return WIN_TYPE_LABELS[winType] ?? winType
}

/**
 * Full names for a select, kept apart from the labels above.
 *
 * A bout list needs "Pin" to fit on one line next to a score; a dropdown asking
 * how the bout ended needs the term as the bracket writes it. Same values, two
 * audiences, so two maps rather than one compromise.
 */
export const WIN_TYPE_OPTIONS: { label: string; value: MatchWinType }[] = [
  { label: 'Decision', value: 'decision' },
  { label: 'Major decision', value: 'majorDecision' },
  { label: 'Technical fall', value: 'techFall' },
  { label: 'Fall', value: 'fall' },
  { label: 'Forfeit', value: 'forfeit' },
  { label: 'Injury default', value: 'injuryDefault' },
  { label: 'Disqualification', value: 'disqualification' },
  { label: 'Bye', value: 'bye' },
]

/** "W by pin", "L by decision" — how a result reads on a bracket. */
export function resultLabel(match: Pick<Match, 'result' | 'winType'>): string {
  if (match.winType === 'bye') return 'Bye'
  return `${match.result === 'win' ? 'W' : 'L'} by ${winTypeLabel(match.winType).toLowerCase()}`
}
