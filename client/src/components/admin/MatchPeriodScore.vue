<script setup lang="ts">
import { computed } from 'vue'
import { periodBreakdown, scoreFromEvents } from 'src/utils/matchScoring'
import type { ScoreMark } from 'src/utils/matchScoring'
import {
  awardMark,
  eventLabel,
  eventName,
  periodLabel,
  periodName,
  winTypeLabel,
} from 'src/utils/matchLabels'
import type { MatchEvent, MatchResult, MatchWinType } from 'src/types'

/**
 * A bout as a scoresheet: who scored what, in which period.
 *
 * Only possible for a bout that was scored live, because only the call log
 * carries periods. A bout typed in from a bracket afterwards has totals and
 * nothing to spread across columns.
 */

const props = defineProps<{
  events: MatchEvent[]
  ourName: string
  theirName: string
  result: MatchResult
  winType: MatchWinType
  officialFor?: number | undefined
  officialAgainst?: number | undefined
}>()

const columns = computed(() => periodBreakdown(props.events))
const derived = computed(() => scoreFromEvents(props.events))

/** The call as made, or the point it handed over. */
function markLabel(mark: ScoreMark): string {
  return mark.kind === 'award' ? awardMark(mark.type) : eventLabel(mark.type)
}

function markTitle(mark: ScoreMark): string {
  const name = eventName(mark.type)
  if (mark.kind === 'award') return `${name} \u2014 ${mark.points} to this wrestler`
  if (mark.kind === 'call') return `${name} \u2014 called on this wrestler`
  return name
}

/**
 * A key for this bout only, in the order the calls first appeared.
 *
 * The marks are the standard ones, so anyone who keeps score can read them
 * unaided — but plenty of people looking at a child's results cannot, and a
 * full printed legend would be mostly rows that never occurred. Listing only
 * what is on this sheet keeps it to a line or two.
 */
const key = computed(() => {
  const seen = new Set<string>()
  const entries: { id: string; mark: string; name: string; scores: boolean }[] = []

  for (const column of columns.value) {
    for (const mark of [...column.wrestler, ...column.opponent]) {
      const id = `${mark.kind}:${mark.type}`
      if (seen.has(id)) continue
      seen.add(id)
      entries.push({
        id,
        mark: markLabel(mark),
        name: mark.kind === 'call' && mark.points === 0 && seen.has(`award:${mark.type}`)
          ? `${eventName(mark.type).toLowerCase()}, the call`
          : eventName(mark.type).toLowerCase(),
        scores: mark.points > 0,
      })
    }
  }

  return entries
})

const winner = computed(() => (props.result === 'win' ? props.ourName : props.theirName))

const resultLine = computed(() => {
  if (props.winType === 'bye') return 'Bye — not wrestled.'
  return `${winner.value} won by ${winTypeLabel(props.winType).toLowerCase()}.`
})

/**
 * Shown only when the two disagree. The table is built from the call log, and
 * where the table's own arithmetic differs from the score the table kept, the
 * table is the thing to distrust.
 */
const officialDiffers = computed(() => {
  if (typeof props.officialFor !== 'number' || typeof props.officialAgainst !== 'number') {
    return false
  }
  return props.officialFor !== derived.value.for
    || props.officialAgainst !== derived.value.against
})
</script>

<template>
  <div class="sheet">
    <div class="sheet__scroll">
      <table class="sheet__table">
        <thead>
          <tr>
            <th class="sheet__who"></th>
            <th
              v-for="column in columns"
              :key="column.period"
              :title="periodName(column.period)"
            >{{ periodLabel(column.period) }}</th>
            <th class="sheet__total">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" class="sheet__who">{{ ourName }}</th>
            <td v-for="column in columns" :key="column.period">
              <span
                v-for="(mark, i) in column.wrestler"
                :key="i"
                class="call"
                :class="{ 'call--free': mark.points === 0 }"
                :title="markTitle(mark)"
              >{{ markLabel(mark) }}</span>
              <span v-if="column.wrestler.length === 0" class="call__none">—</span>
            </td>
            <td class="sheet__total">{{ derived.for }}</td>
          </tr>
          <tr>
            <th scope="row" class="sheet__who">{{ theirName }}</th>
            <td v-for="column in columns" :key="column.period">
              <span
                v-for="(mark, i) in column.opponent"
                :key="i"
                class="call"
                :class="{ 'call--free': mark.points === 0 }"
                :title="markTitle(mark)"
              >{{ markLabel(mark) }}</span>
              <span v-if="column.opponent.length === 0" class="call__none">—</span>
            </td>
            <td class="sheet__total">{{ derived.against }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="sheet__result">{{ resultLine }}</div>

    <ul v-if="key.length" class="sheet__key">
      <li v-for="entry in key" :key="entry.id">
        <span
          class="call call--key"
          :class="{ 'call--free': !entry.scores }"
        >{{ entry.mark }}</span>{{ entry.name }}
      </li>
    </ul>

    <!-- The thing the marks cannot say on their own. -->
    <p class="sheet__note">
      An infraction appears twice: outlined against the wrestler it was called
      on, and filled on the other wrestler's line for the point it gave them.
    </p>

    <p v-if="officialDiffers" class="sheet__warn">
      <q-icon name="warning" size="15px" class="q-mr-xs" />
      The table adds up to {{ derived.for }}–{{ derived.against }} but the bout
      was recorded as {{ officialFor }}–{{ officialAgainst }}. The official
      score stands; the breakdown above is the part to doubt.
    </p>
  </div>
</template>

<style scoped>
.sheet__scroll {
  /* Overtime can push this past a phone's width, and a table that scrolls is
     better than one that crushes its columns to nothing. */
  overflow-x: auto;
}

.sheet__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.sheet__table th,
.sheet__table td {
  border: 1px solid var(--grey-200);
  padding: 5px 6px;
  text-align: center;
  vertical-align: top;
}

.sheet__table thead th {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--grey-500);
  background: var(--grey-050, #fafafa);
  white-space: nowrap;
}

.sheet__who {
  text-align: left;
  font-weight: 600;
  color: var(--navy-800);
  white-space: nowrap;
  /* The names are the one column worth keeping legible at any width. */
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sheet__total {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--navy-800);
}

.call {
  display: inline-block;
  min-width: 22px;
  margin: 1px;
  padding: 1px 4px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--navy-800);
  color: #fff;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.72rem;
}

/* Scores nothing, so it is drawn as an outline rather than a filled point. */
.call--free {
  background: transparent;
  border-color: var(--grey-300);
  color: var(--grey-500);
}

.call__none {
  color: var(--grey-300);
}

.sheet__result {
  margin-top: 10px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  background: var(--grey-050, #fafafa);
  border: 1px solid var(--grey-200);
  font-weight: 600;
  font-size: 0.86rem;
  color: var(--navy-800);
  text-align: center;
}

.sheet__key {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  font-size: 0.74rem;
  color: var(--grey-500);
}

.sheet__key li {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Same chip as the table, so the key is read by matching shapes. */
.call--key {
  margin: 0;
}

.sheet__note {
  margin: 8px 0 0;
  font-size: 0.74rem;
  line-height: 1.5;
  color: var(--grey-500);
}

.sheet__warn {
  display: flex;
  align-items: flex-start;
  margin: 8px 0 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--negative, #c10015);
}
</style>
