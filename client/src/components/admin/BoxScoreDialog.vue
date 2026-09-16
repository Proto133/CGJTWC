<script setup lang="ts">
import { computed } from 'vue'
import {
  countsFromEvents,
  creditedSide,
  eventPoints,
  isInfraction,
  renormaliseInfractions,
  scoreFromEvents,
} from 'src/utils/matchScoring'
import { eventLabel, eventName } from 'src/utils/matchLabels'
import type { MatchCounts, MatchEvent } from 'src/types'

/**
 * The bout so far, in full, and correctable.
 *
 * Undo only reaches the most recent call, which is no help when the mistake was
 * four calls ago — and the mistake is nearly always the same one: the right
 * call tapped in the wrong column. So the two actions here are move it to the
 * other wrestler and remove it, which between them cover everything short of
 * having missed a call entirely, and the scoring buttons already handle that.
 *
 * The bout is still in memory at this point; nothing here touches Firestore.
 */

const props = defineProps<{
  modelValue: boolean
  events: MatchEvent[]
  ourName: string
  theirName: string
  ourBand: 'red' | 'green'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void
  (e: 'update:events', events: MatchEvent[]): void
}>()

const theirBand = computed<'red' | 'green'>(() => (props.ourBand === 'red' ? 'green' : 'red'))

const score = computed(() => scoreFromEvents(props.events))
const ourCounts = computed(() => countsFromEvents(props.events, 'wrestler'))
const theirCounts = computed(() => countsFromEvents(props.events, 'opponent'))

/** The box score proper: what each wrestler did, side by side. */
const ROWS: { key: keyof MatchCounts; label: string }[] = [
  { key: 'takedowns', label: 'Takedowns' },
  { key: 'escapes', label: 'Escapes' },
  { key: 'reversals', label: 'Reversals' },
  { key: 'nearFall2', label: 'Near fall 2' },
  { key: 'nearFall3', label: 'Near fall 3' },
  { key: 'nearFall4', label: 'Near fall 4' },
  { key: 'penalties', label: 'Penalties' },
  { key: 'stalls', label: 'Stalling' },
  { key: 'cautions', label: 'Cautions' },
]

/** Newest first: a correction is nearly always to something recent. */
const log = computed(() =>
  props.events
    .map((event, index) => ({
      index,
      event,
      band: event.side === 'wrestler' ? props.ourBand : theirBand.value,
      infraction: isInfraction(event.type),
      points: eventPoints(event.type),
      // Who the points went to, which for an infraction is not who it was on.
      creditedBand: creditedSide(event) === 'wrestler' ? props.ourBand : theirBand.value,
    }))
    .reverse())

/**
 * Both edits renormalise, because stalls and cautions are priced by how many
 * came before them. Moving one across repices that wrestler's whole sequence
 * and the other's, and doing it by hand is exactly the arithmetic this screen
 * exists to avoid.
 */
function moveAcross(index: number) {
  const next = props.events.map((event, i) => (
    i === index
      ? { ...event, side: event.side === 'wrestler' ? 'opponent' as const : 'wrestler' as const }
      : event
  ))
  emit('update:events', renormaliseInfractions(next))
}

function removeAt(index: number) {
  emit('update:events', renormaliseInfractions(props.events.filter((_, i) => i !== index)))
}

function nameFor(band: 'red' | 'green'): string {
  return band === props.ourBand ? props.ourName : props.theirName
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="box-card">
      <q-card-section class="box-head">
        <div class="box-head__title">Box score</div>
        <div class="box-head__score">
          <span :class="`ink--${ourBand}`">{{ score.for }}</span>
          <span class="box-head__dash">–</span>
          <span :class="`ink--${theirBand}`">{{ score.against }}</span>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <table class="box-table">
          <thead>
            <tr>
              <th></th>
              <th :class="`ink--${ourBand}`">{{ ourName || 'Ours' }}</th>
              <th :class="`ink--${theirBand}`">{{ theirName || 'Opponent' }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in ROWS" :key="row.key">
              <th scope="row">{{ row.label }}</th>
              <td>{{ ourCounts[row.key] }}</td>
              <td>{{ theirCounts[row.key] }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Stated because the columns invite the opposite reading: these three
             are counted against the wrestler they were called on, so the points
             they produced are on the other side of the table. -->
        <p class="box-note">
          Penalties, stalling and cautions are counted against the wrestler they
          were called on. Their points went to the other wrestler.
        </p>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="box-label">Every call, newest first</div>

        <div v-if="log.length === 0" class="empty-state">
          Nothing recorded yet.
        </div>

        <ul v-else class="calls">
          <li v-for="entry in log" :key="entry.index" class="call">
            <span class="call__chip" :class="[
              `chip--${entry.band}`,
              { 'chip--outline': entry.infraction },
            ]">{{ eventLabel(entry.event.type) }}</span>

            <span class="call__body">
              <span class="call__name">{{ eventName(entry.event.type) }}</span>
              <span class="call__meta">
                Period {{ entry.event.period }} · on {{ nameFor(entry.band) }}
                <template v-if="entry.points > 0">
                  · {{ entry.points }} to {{ nameFor(entry.creditedBand) }}
                </template>
                <template v-else> · no points</template>
              </span>
            </span>

            <q-btn
              dense
              flat
              round
              size="sm"
              icon="swap_horiz"
              :aria-label="`Move this call to the other wrestler`"
              @click="moveAcross(entry.index)"
            />
            <q-btn
              dense
              flat
              round
              size="sm"
              color="negative"
              icon="close"
              aria-label="Remove this call"
              @click="removeAt(entry.index)"
            />
          </li>
        </ul>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-close-popup unelevated no-caps color="primary" label="Done" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.box-card {
  width: 520px;
  max-width: 94vw;
}

.ink--red {
  color: #c62431;
}

.ink--green {
  color: #14803c;
}

.box-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.box-head__title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.2rem;
  text-transform: uppercase;
  color: var(--navy-800);
}

.box-head__score {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.8rem;
  line-height: 1;
}

.box-head__dash {
  color: var(--grey-300);
  margin: 0 6px;
}

.box-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.box-table th,
.box-table td {
  padding: 5px 6px;
  text-align: center;
}

.box-table thead th {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 2px solid var(--grey-200);
}

.box-table tbody th {
  text-align: left;
  font-weight: 400;
  color: var(--grey-600);
}

.box-table tbody tr:nth-child(even) {
  background: var(--grey-050, #fafafa);
}

.box-table tbody td {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--navy-800);
}

.box-note {
  margin: 10px 0 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--grey-500);
}

.box-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--grey-500);
  margin-bottom: 8px;
}

.calls {
  list-style: none;
  margin: 0;
  padding: 0;
}

.call {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-top: 1px solid var(--grey-200);
}

.call:first-child {
  border-top: none;
}

/* Same treatment as the scoring buttons: filled scores for that colour,
   outlined was called on it. Consistency across the two screens is what makes
   the log readable without a legend. */
.call__chip {
  flex: none;
  width: 34px;
  text-align: center;
  padding: 3px 0;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.8rem;
  color: #fff;
}

.chip--red {
  background: #c62431;
}

.chip--green {
  background: #14803c;
}

.chip--outline {
  background: transparent;
}

.chip--outline.chip--red {
  border-color: #c62431;
  color: #c62431;
}

.chip--outline.chip--green {
  border-color: #14803c;
  color: #14803c;
}

.call__body {
  flex: 1;
  min-width: 0;
}

.call__name {
  display: block;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--navy-800);
}

.call__meta {
  display: block;
  font-size: 0.76rem;
  color: var(--grey-500);
}
</style>
