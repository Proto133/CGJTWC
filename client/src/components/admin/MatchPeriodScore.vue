<script setup lang="ts">
import { computed } from 'vue'
import {
  eventPoints,
  isInfraction,
  periodBreakdown,
  scoreFromEvents,
} from 'src/utils/matchScoring'
import {
  eventLabel,
  eventName,
  infractionMark,
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

/**
 * A move is its shorthand; an infraction is written out.
 *
 * The shorthand works for a move because it sits with the wrestler who made
 * it. An infraction sits with the wrestler who gained by it, so it has to say
 * so rather than leaving "S1" to be misread as them having stalled.
 */
function markLabel(event: MatchEvent): string {
  const points = eventPoints(event.type)
  return isInfraction(event.type)
    ? infractionMark(event.type, points)
    : eventLabel(event.type)
}

function cellTitle(event: MatchEvent): string {
  return `${eventName(event.type)}, ${periodName(event.period)}`
}

/** Warnings and cautions score nothing, and are drawn so they do not look like they do. */
function scores(event: MatchEvent): boolean {
  return eventPoints(event.type) > 0
}

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
                v-for="(event, i) in column.wrestler"
                :key="i"
                class="call"
                :class="{ 'call--free': !scores(event) }"
                :title="cellTitle(event)"
              >{{ markLabel(event) }}</span>
              <span v-if="column.wrestler.length === 0" class="call__none">—</span>
            </td>
            <td class="sheet__total">{{ derived.for }}</td>
          </tr>
          <tr>
            <th scope="row" class="sheet__who">{{ theirName }}</th>
            <td v-for="column in columns" :key="column.period">
              <span
                v-for="(event, i) in column.opponent"
                :key="i"
                class="call"
                :class="{ 'call--free': !scores(event) }"
                :title="cellTitle(event)"
              >{{ markLabel(event) }}</span>
              <span v-if="column.opponent.length === 0" class="call__none">—</span>
            </td>
            <td class="sheet__total">{{ derived.against }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="sheet__result">{{ resultLine }}</div>

    <!-- Worth saying rather than leaving someone to add the rows up and wonder.
         Penalty points sit with the wrestler who gained them, which is not the
         one the call was made against. -->
    <p class="sheet__key">
      “Stall 1” and the like are points <em>gained</em> because the other
      wrestler was penalised, which is why they sit on this line. Outlined marks
      are calls that scored nothing, shown against the wrestler they were called
      on.
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
