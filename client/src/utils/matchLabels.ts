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
 * The standard scoresheet abbreviations, used everywhere a call is shown.
 *
 * These are not ours to invent. A letter for the call and a digit for what it
 * was worth is what is printed on a scoresheet and what anyone who keeps score
 * already reads, so a coach can look at this app's sheet and a paper one
 * without translating between them.
 *
 * The takedown is T3 rather than the T2 on older printed legends because NFHS
 * moved it to three points — which is also why the value lives in the POINTS
 * table and only the name is written here. A sheet from an earlier season
 * would say T2 and mean it.
 */
const EVENT_LABELS: Record<MatchEventType, string> = {
  takedown: 'T3',
  escape: 'E1',
  reversal: 'R2',
  nearFall2: 'N2',
  nearFall3: 'N3',
  nearFall4: 'N4',
  penalty1: 'P1',
  penalty2: 'P2',
  /** Lowercase w, as printed: a warning rather than a point. */
  stallWarning: 'Sw',
  stallPoint: 'S1',
  stallPoint2: 'S2',
  stallDq: 'DQ',
  caution: 'C',
  /** The point earned after a second caution, exactly as the legend has it. */
  cautionPoint: 'C1',
  chooseUp: '\u25B2',
  chooseDown: '\u25BC',
  chooseNeutral: '=',
  defer: 'D',
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
  chooseUp: 'Selects up',
  chooseDown: 'Selects down',
  chooseNeutral: 'Selects neutral',
  defer: 'Defers',
}

export function eventLabel(type: MatchEventType): string {
  return EVENT_LABELS[type] ?? type
}

export function eventName(type: MatchEventType): string {
  return EVENT_NAMES[type] ?? type
}

/**
 * Three periods, then IKWF overtime: a minute of sudden victory, then a
 * thirty-second tiebreaker.
 *
 * SV and TB are the legend's own abbreviations. Abbreviated at all because
 * these are column headings on a table that can run to six columns on a
 * phone; the full wording goes in the cell's title.
 */
const PERIOD_MARKS: Record<number, string> = { 4: 'SV', 5: 'TB' }
const PERIOD_NAMES: Record<number, string> = { 4: 'Sudden victory', 5: 'Tiebreaker' }

export function periodLabel(period: number): string {
  if (period <= 3) return `P${period}`
  return PERIOD_MARKS[period] ?? `TB${period - 4}`
}

export function periodName(period: number): string {
  if (period <= 3) return `Period ${period}`
  return PERIOD_NAMES[period] ?? `Tiebreaker ${period - 4}`
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
