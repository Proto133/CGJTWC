import type { Match, MatchCounts, MatchWinType } from 'src/types'
import { emptyCounts, isComplete, matchCounts, reconcile, teamPoints } from 'src/utils/matchScoring'

/**
 * Season totals for a wrestler.
 *
 * Two different denominators run through this, and conflating them is the
 * mistake worth avoiding:
 *
 *   - The win-loss record counts every bout. A win is a win whether or not
 *     anyone typed the scoring detail afterwards.
 *   - Takedowns, points and the rest count only bouts whose detail reconciles.
 *     A bout entered as a result alone has no takedowns recorded, which is not
 *     the same as zero takedowns, and averaging the two together produces a
 *     figure that is quietly wrong.
 *
 * `detailedBouts` is therefore reported alongside the counts, so a display can
 * say what the number is actually drawn from.
 */

export interface WrestlerSummary {
  /** Bouts that count towards a record. Byes are excluded. */
  bouts: number
  wins: number
  losses: number
  /** Wins by how they were won, for "5 pins this season". */
  winsByType: Record<MatchWinType, number>
  /** NFHS points this wrestler earned the team, from their wins. */
  teamPoints: number

  /** How many bouts contributed to the figures below. */
  detailedBouts: number
  counts: MatchCounts
  pointsFor: number
  pointsAgainst: number

  /** Bouts whose detail is missing or disagrees with the official score. */
  needsAttention: number
}

function emptyWinsByType(): Record<MatchWinType, number> {
  return {
    decision: 0,
    majorDecision: 0,
    techFall: 0,
    fall: 0,
    forfeit: 0,
    injuryDefault: 0,
    disqualification: 0,
    bye: 0,
  }
}

export function emptySummary(): WrestlerSummary {
  return {
    bouts: 0,
    wins: 0,
    losses: 0,
    winsByType: emptyWinsByType(),
    teamPoints: 0,
    detailedBouts: 0,
    counts: emptyCounts(),
    pointsFor: 0,
    pointsAgainst: 0,
    needsAttention: 0,
  }
}

export function summarise(matches: Match[]): WrestlerSummary {
  const summary = emptySummary()

  for (const match of matches) {
    // A bye advances a wrestler without them wrestling anybody, so it is not a
    // win and does not belong in a record. It is still stored, because the
    // bracket had one and a gap in the sequence would look like a lost result.
    if (match.winType !== 'bye') {
      summary.bouts += 1
      if (match.result === 'win') {
        summary.wins += 1
        summary.winsByType[match.winType] += 1
        summary.teamPoints += teamPoints(match.winType)
      } else {
        summary.losses += 1
      }
    }

    const state = reconcile(match)
    if (state === 'resultOnly' || state === 'mismatch') summary.needsAttention += 1

    // Only bouts whose detail can be trusted contribute to the totals.
    if (!isComplete(match)) continue

    const counts = matchCounts(match)
    if (counts) {
      summary.detailedBouts += 1
      summary.counts.takedowns += counts.takedowns
      summary.counts.escapes += counts.escapes
      summary.counts.reversals += counts.reversals
      summary.counts.nearFall2 += counts.nearFall2
      summary.counts.nearFall3 += counts.nearFall3
      summary.counts.nearFall4 += counts.nearFall4
      summary.counts.penalties += counts.penalties
      summary.counts.stalls += counts.stalls
      summary.counts.cautions += counts.cautions
    }

    if (typeof match.officialFor === 'number') summary.pointsFor += match.officialFor
    if (typeof match.officialAgainst === 'number') summary.pointsAgainst += match.officialAgainst
  }

  return summary
}

/** "7–2", or an en dash when nothing has been wrestled. */
export function recordLabel(summary: WrestlerSummary): string {
  if (summary.bouts === 0) return '\u2013'
  return `${summary.wins}\u2013${summary.losses}`
}

export function nearFallTotal(counts: MatchCounts): number {
  return counts.nearFall2 + counts.nearFall3 + counts.nearFall4
}

/**
 * Team points a club earned at one event.
 *
 * Only wins score, and a bye scores nothing, which `teamPoints` already knows.
 */
export function eventTeamPoints(matches: Match[]): number {
  return matches
    .filter((m) => m.result === 'win')
    .reduce((sum, m) => sum + teamPoints(m.winType), 0)
}

