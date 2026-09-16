import type {
  Match,
  MatchCounts,
  MatchEvent,
  MatchEventType,
  MatchWinType,
} from 'src/types'

/**
 * Folkstyle scoring, derived from an event log.
 *
 * IKWF runs NFHS rules with its own modifications and uses NFHS team scoring.
 * Point values therefore live in one table rather than being written into
 * stored rows: NFHS moved the takedown from two points to three, and a stored
 * points figure would silently make seasons before and after that change
 * incomparable. Counts are stored; points are computed.
 *
 * Confirmed with the club that IKWF has no riding time, so every point on the
 * board has a counted source. That is what makes `reconcile` below able to tell
 * a complete bout from one where only the result was entered.
 *
 * Pure on purpose — no Firebase imports — so the derivation can be exercised
 * directly.
 */

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/**
 * Points awarded by each call.
 *
 * Near fall values are in the event name rather than this table, so a change to
 * near-fall rules cannot retroactively reinterpret a bout that was recorded
 * under the old ones.
 */
const POINTS: Record<MatchEventType, number> = {
  takedown: 3,
  escape: 1,
  reversal: 2,
  nearFall2: 2,
  nearFall3: 3,
  nearFall4: 4,
  penalty1: 1,
  penalty2: 2,
  // A warning is recorded because the sequence determines what the next
  // infraction costs, but it puts nothing on the board.
  stallWarning: 0,
  stallPoint: 1,
  stallPoint2: 2,
  // The fifth ends the bout rather than scoring. Recorded so the count is
  // complete and the disqualification has something behind it.
  stallDq: 0,
  caution: 0,
  cautionPoint: 1,
}

/**
 * Calls whose points go to the opponent of the wrestler they were made on.
 *
 * `MatchEvent.side` names the offender for these, matching how the official
 * calls it. Inverting here keeps that inversion in exactly one place.
 */
const INFRACTIONS: ReadonlySet<MatchEventType> = new Set<MatchEventType>([
  'penalty1',
  'penalty2',
  'stallWarning',
  'stallPoint',
  'stallPoint2',
  'stallDq',
  'caution',
  'cautionPoint',
])

/** Whether a call is credited to the opponent of the wrestler it was made on. */
export function isInfraction(type: MatchEventType): boolean {
  return INFRACTIONS.has(type)
}

const STALLS: ReadonlySet<MatchEventType> = new Set<MatchEventType>([
  'stallWarning',
  'stallPoint',
  'stallPoint2',
  'stallDq',
])

const CAUTIONS: ReadonlySet<MatchEventType> = new Set<MatchEventType>([
  'caution',
  'cautionPoint',
])

/** Folkstyle technical superiority. A rules value, not a constant. */
export const TECH_FALL_MARGIN = 15

/**
 * The NFHS stalling chart (7-6, 8-1-4), in order.
 *
 * Stalling was taken out of the general penalty progression so officials could
 * call it earlier without it interacting with other infractions, so it is
 * counted and priced entirely on its own. Warnings and penalties are
 * cumulative across the whole bout, not per period.
 */
const STALL_SEQUENCE: readonly MatchEventType[] = [
  'stallWarning',
  'stallPoint',
  'stallPoint',
  'stallPoint2',
  'stallDq',
]

/** The fifth call disqualifies. Worth naming, because the UI counts up to it. */
export const STALL_DQ_AT = STALL_SEQUENCE.length

/** Plain-language consequence of the next call, by rung. */
const STALL_CONSEQUENCES: readonly string[] = [
  'Warning',
  '1 point',
  '1 point',
  '2 points',
  'Disqualification',
]

/**
 * The call the next stall on a wrestler produces, from how many they already
 * have.
 *
 * Clamped rather than thrown past the fifth: the bout ends there, and a stray
 * tap on a finished bout should not be an exception.
 */
export function nextStallCall(priorStalls: number): MatchEventType {
  const index = Math.min(Math.max(priorStalls, 0), STALL_SEQUENCE.length - 1)
  return STALL_SEQUENCE[index] as MatchEventType
}

export function stallConsequence(priorStalls: number): string {
  const index = Math.min(Math.max(priorStalls, 0), STALL_CONSEQUENCES.length - 1)
  return STALL_CONSEQUENCES[index] as string
}

/** The same, abbreviated for a button caption. */
const STALL_CONSEQUENCES_SHORT: readonly string[] = ['Warn', '1 pt', '1 pt', '2 pts', 'DQ']

export function stallConsequenceShort(priorStalls: number): string {
  const index = Math.min(Math.max(priorStalls, 0), STALL_CONSEQUENCES_SHORT.length - 1)
  return STALL_CONSEQUENCES_SHORT[index] as string
}

/** Stalls called on one wrestler. `side` is the offender, as recorded. */
export function stallCount(events: MatchEvent[], side: 'wrestler' | 'opponent'): number {
  return events.filter((e) => e.side === side && STALLS.has(e.type)).length
}

/**
 * False start and incorrect starting position (8-1-3).
 *
 * A third counter, independent of both the stalling chart and the general
 * penalty progression: two cautions are free, then every subsequent one is a
 * point. There is no disqualification rung, so unlike stalling this does not
 * terminate — hence a threshold rather than a fixed sequence.
 */
export const CAUTIONS_FREE = 2

export function nextCautionCall(priorCautions: number): MatchEventType {
  return priorCautions < CAUTIONS_FREE ? 'caution' : 'cautionPoint'
}

export function cautionConsequence(priorCautions: number): string {
  return priorCautions < CAUTIONS_FREE ? 'Caution' : '1 point'
}

export function cautionConsequenceShort(priorCautions: number): string {
  return priorCautions < CAUTIONS_FREE ? 'Caution' : '1 pt'
}

export function cautionCount(events: MatchEvent[], side: 'wrestler' | 'opponent'): number {
  return events.filter((e) => e.side === side && CAUTIONS.has(e.type)).length
}

/**
 * Rewrites every position-priced call to match its chart.
 *
 * Stalls and cautions cost what they cost because of how many came before them
 * on that wrestler, so deleting one or reassigning it to the other side
 * reprices every one after it. A log edited without this would show a score the
 * rules cannot produce — the first stall billed as a point, say, because the
 * warning ahead of it was removed.
 *
 * Everything else is priced by its own name and passes through untouched.
 */
export function renormaliseInfractions(events: MatchEvent[]): MatchEvent[] {
  const stalls = { wrestler: 0, opponent: 0 }
  const cautions = { wrestler: 0, opponent: 0 }

  return events.map((event) => {
    if (STALLS.has(event.type)) {
      const type = nextStallCall(stalls[event.side])
      stalls[event.side] += 1
      return type === event.type ? event : { ...event, type }
    }

    if (CAUTIONS.has(event.type)) {
      const type = nextCautionCall(cautions[event.side])
      cautions[event.side] += 1
      return type === event.type ? event : { ...event, type }
    }

    return event
  })
}

/** NFHS dual-meet team points, which IKWF adopts wholesale. */
const TEAM_POINTS: Record<MatchWinType, number> = {
  fall: 6,
  forfeit: 6,
  injuryDefault: 6,
  disqualification: 6,
  techFall: 5,
  majorDecision: 4,
  decision: 3,
  // A bye is not wrestled and scores nothing in a dual.
  bye: 0,
}

export function teamPoints(winType: MatchWinType): number {
  return TEAM_POINTS[winType] ?? 0
}

/** Win types with no score to reconcile, because no wrestling happened. */
const UNWRESTLED: ReadonlySet<MatchWinType> = new Set<MatchWinType>([
  'forfeit',
  'bye',
])

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

export function emptyCounts(): MatchCounts {
  return {
    takedowns: 0,
    escapes: 0,
    reversals: 0,
    nearFall2: 0,
    nearFall3: 0,
    nearFall4: 0,
    penalties: 0,
    stalls: 0,
    cautions: 0,
  }
}

/** Which side a call actually credits, after inverting infractions. */
export function creditedSide(event: MatchEvent): 'wrestler' | 'opponent' {
  if (!INFRACTIONS.has(event.type)) return event.side
  return event.side === 'wrestler' ? 'opponent' : 'wrestler'
}

export function eventPoints(type: MatchEventType): number {
  return POINTS[type] ?? 0
}

/**
 * Counts for one side of a bout.
 *
 * Counted by who *performed* the action rather than who was credited, because
 * "most takedowns" means takedowns executed. Infractions are the exception and
 * are counted against the offender, which is the useful reading of "penalties".
 */
export function countsFromEvents(
  events: MatchEvent[],
  side: 'wrestler' | 'opponent' = 'wrestler',
): MatchCounts {
  const counts = emptyCounts()

  for (const event of events) {
    if (event.side !== side) continue

    switch (event.type) {
      case 'takedown': counts.takedowns += 1; break
      case 'escape': counts.escapes += 1; break
      case 'reversal': counts.reversals += 1; break
      case 'nearFall2': counts.nearFall2 += 1; break
      case 'nearFall3': counts.nearFall3 += 1; break
      case 'nearFall4': counts.nearFall4 += 1; break
      case 'penalty1':
      case 'penalty2': counts.penalties += 1; break
      case 'stallWarning':
      case 'stallPoint':
      case 'stallPoint2':
      case 'stallDq': counts.stalls += 1; break
      case 'caution':
      case 'cautionPoint': counts.cautions += 1; break
    }
  }

  return counts
}

/**
 * The bout's counts, from whichever source exists.
 *
 * A log wins over stored counts: if a bout was scored live and later had counts
 * written as well, the log is the more detailed record.
 */
export function matchCounts(match: Pick<Match, 'events' | 'counts'>): MatchCounts | null {
  if (match.events?.length) return countsFromEvents(match.events)
  if (!match.counts) return null
  // Merged over a blank set rather than returned raw: a stored map missing a
  // key reads as undefined, and undefined added to a running total is NaN,
  // which then poisons every figure downstream of it without erroring.
  return { ...emptyCounts(), ...match.counts }
}

export interface Score {
  for: number
  against: number
}

export function scoreFromEvents(events: MatchEvent[]): Score {
  const score: Score = { for: 0, against: 0 }

  for (const event of events) {
    const points = eventPoints(event.type)
    if (points === 0) continue
    if (creditedSide(event) === 'wrestler') score.for += points
    else score.against += points
  }

  return score
}

/** Points implied by stored counts, for a bout entered by hand. */
export function scoreFromCounts(counts: MatchCounts): number {
  return counts.takedowns * POINTS.takedown
    + counts.escapes * POINTS.escape
    + counts.reversals * POINTS.reversal
    + counts.nearFall2 * POINTS.nearFall2
    + counts.nearFall3 * POINTS.nearFall3
    + counts.nearFall4 * POINTS.nearFall4
}

/**
 * The score this bout's detail implies, or null when there is no detail.
 *
 * Only a log can give both sides. Hand-entered counts describe one wrestler, so
 * the opposing figure is unknowable from them.
 */
export function derivedScore(match: Pick<Match, 'events'>): Score | null {
  if (!match.events?.length) return null
  return scoreFromEvents(match.events)
}

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

export type Reconciliation =
  /** Detail present and consistent with the official score. */
  | 'complete'
  /** Nothing to reconcile: a forfeit or a bye. */
  | 'notApplicable'
  /** The result was entered without the detail behind it. */
  | 'resultOnly'
  /** Detail exists but disagrees with the official score. */
  | 'mismatch'
  /** No official score recorded, so nothing can be checked. */
  | 'unverifiable'

/**
 * Whether a bout's detail can be trusted.
 *
 * This is what lets badges tell "no points against" apart from "nobody entered
 * the detail" — the trap that otherwise hands every "least" badge to whoever
 * has the least data.
 *
 * An injury default stopped at nil-nil reconciles without anyone having to mark
 * it complete: the counts sum to zero and so does the official score. A manual
 * "detail entered" flag would have got that case wrong.
 */
export function reconcile(match: Pick<
  Match,
  'events' | 'counts' | 'winType' | 'officialFor' | 'officialAgainst'
>): Reconciliation {
  if (UNWRESTLED.has(match.winType)) return 'notApplicable'

  const hasOfficial = typeof match.officialFor === 'number'
    && typeof match.officialAgainst === 'number'

  if (match.events?.length) {
    if (!hasOfficial) return 'unverifiable'
    const derived = scoreFromEvents(match.events)
    return derived.for === match.officialFor && derived.against === match.officialAgainst
      ? 'complete'
      : 'mismatch'
  }

  if (match.counts) {
    if (!hasOfficial) return 'unverifiable'
    return scoreFromCounts(match.counts) === match.officialFor ? 'complete' : 'mismatch'
  }

  // No detail at all. A genuine nil-nil bout still reconciles: there was
  // nothing to record, and the official score says so.
  if (hasOfficial && match.officialFor === 0 && match.officialAgainst === 0) {
    return 'complete'
  }

  return 'resultOnly'
}

/** Eligible to contribute to a statistic that depends on scoring detail. */
export function isComplete(match: Parameters<typeof reconcile>[0]): boolean {
  const state = reconcile(match)
  return state === 'complete' || state === 'notApplicable'
}

// ---------------------------------------------------------------------------
// Live scoring helpers
// ---------------------------------------------------------------------------

/**
 * Removes the most recent call.
 *
 * Undo is not a nicety here. Scoring a one-minute youth period on a phone means
 * mis-taps, and without this the only remedy is discarding the bout.
 */
export function undoLast(events: MatchEvent[]): MatchEvent[] {
  return events.slice(0, -1)
}

/**
 * The win type a finished bout implies, from the score alone.
 *
 * A suggestion for the End Match prompt, never an override: a fall or an injury
 * default can happen at any score and only the scorer knows which occurred.
 */
export function suggestWinType(score: Score): MatchWinType {
  const margin = Math.abs(score.for - score.against)
  if (margin >= TECH_FALL_MARGIN) return 'techFall'
  if (margin >= 8) return 'majorDecision'
  return 'decision'
}
