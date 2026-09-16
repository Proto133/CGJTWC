<script setup lang="ts">
import { computed, ref } from 'vue'
import { date as qdate } from 'quasar'
import { useMatchesStore } from 'stores/matches'
import MatchEditDialog from 'components/admin/MatchEditDialog.vue'
import { reconcile } from 'src/utils/matchScoring'
import {
  nearFallTotal,
  recordLabel,
  resultLabel,
  summarise,
} from 'src/utils/wrestlerStats'
import type { Match, Wrestler } from 'src/types'

const props = defineProps<{
  modelValue: boolean
  wrestler: Wrestler | null
}>()

const editOpen = ref(false)
const editing = ref<Match | null>(null)

function openEdit(match: Match) {
  editing.value = match
  editOpen.value = true
}

const emit = defineEmits<{ (e: 'update:modelValue', open: boolean): void }>()

const matchesStore = useMatchesStore()

/** Most recent first: the bout someone is checking is usually the last one. */
const bouts = computed<Match[]>(() => {
  if (!props.wrestler) return []
  return [...matchesStore.forWrestler(props.wrestler.id)]
    .sort((a, b) => b.date.toMillis() - a.date.toMillis())
})

const summary = computed(() => summarise(bouts.value))

const name = computed(() =>
  props.wrestler ? `${props.wrestler.firstName} ${props.wrestler.lastName}` : '')

function when(match: Match): string {
  return qdate.formatDate(match.date.toDate(), 'MMM D')
}

function score(match: Match): string {
  if (typeof match.officialFor !== 'number') return ''
  return `${match.officialFor}\u2013${match.officialAgainst ?? 0}`
}

/** Why a bout is not contributing to the totals, in words. */
function flag(match: Match): string {
  switch (reconcile(match)) {
    case 'resultOnly': return 'no scoring detail'
    case 'mismatch': return 'detail does not match the score'
    case 'unverifiable': return 'no official score'
    default: return ''
  }
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card v-if="wrestler" class="stats-card">
      <q-card-section>
        <div class="dialog-title">{{ name }}</div>
        <div class="dialog-sub">Season record</div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="stat-row">
          <div class="stat">
            <div class="stat__value">{{ recordLabel(summary) }}</div>
            <div class="stat__label">Record</div>
          </div>
          <div class="stat">
            <div class="stat__value">{{ summary.winsByType.fall }}</div>
            <div class="stat__label">Pins</div>
          </div>
          <div class="stat">
            <div class="stat__value">{{ summary.teamPoints }}</div>
            <div class="stat__label">Team pts</div>
          </div>
        </div>

        <!-- The denominator is shown rather than implied. A takedown total
             drawn from four of eleven bouts is not a season total, and saying
             so is the difference between a useful number and a misleading one. -->
        <div v-if="summary.detailedBouts > 0" class="detail-block">
          <div class="detail-block__head">
            Scoring detail, from {{ summary.detailedBouts }} of
            {{ summary.bouts }} bout{{ summary.bouts === 1 ? '' : 's' }}
          </div>
          <div class="detail-grid">
            <div><span>{{ summary.counts.takedowns }}</span> takedowns</div>
            <div><span>{{ summary.counts.escapes }}</span> escapes</div>
            <div><span>{{ summary.counts.reversals }}</span> reversals</div>
            <div><span>{{ nearFallTotal(summary.counts) }}</span> near falls</div>
            <div><span>{{ summary.pointsFor }}</span> points for</div>
            <div><span>{{ summary.pointsAgainst }}</span> points against</div>
          </div>
        </div>
        <div v-else-if="summary.bouts > 0" class="detail-none">
          No bout has full scoring detail yet, so only the record is available.
        </div>

        <div v-if="summary.needsAttention > 0" class="attention">
          <q-icon name="info" size="15px" class="q-mr-xs" />
          {{ summary.needsAttention }}
          bout{{ summary.needsAttention === 1 ? '' : 's' }} missing detail or not
          matching the official score. Those are left out of the totals above.
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="block-label">Bouts</div>

        <div v-if="bouts.length === 0" class="empty-state">
          Nothing recorded yet.
        </div>

        <!-- Every bout is a button. A wrong result is the thing most worth
             fixing here, and it is the thing you are already looking at. -->
        <ul v-else class="bout-list">
          <li
            v-for="bout in bouts"
            :key="bout.id"
            class="bout"
            role="button"
            tabindex="0"
            @click="openEdit(bout)"
            @keydown.enter="openEdit(bout)"
            @keydown.space.prevent="openEdit(bout)"
          >
            <div class="bout__main">
              <span class="bout__result" :class="{
                'bout__result--win': bout.result === 'win' && bout.winType !== 'bye',
              }">
                {{ resultLabel(bout) }}
              </span>
              <span v-if="score(bout)" class="bout__score">{{ score(bout) }}</span>
            </div>
            <div class="bout__meta">
              {{ when(bout) }}
              <template v-if="bout.opponentName"> · {{ bout.opponentName }}</template>
              <template v-if="bout.opponentTeam"> ({{ bout.opponentTeam }})</template>
              <template v-if="bout.eventName"> · {{ bout.eventName }}</template>
            </div>
            <div v-if="flag(bout)" class="bout__flag">{{ flag(bout) }}</div>
          </li>
        </ul>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-close-popup flat no-caps label="Close" />
      </q-card-actions>
    </q-card>

    <MatchEditDialog v-model="editOpen" :match="editing" />
  </q-dialog>
</template>

<style scoped>
.stats-card {
  width: 520px;
  max-width: 94vw;
}

.dialog-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.2rem;
  text-transform: uppercase;
  color: var(--navy-800);
}

.dialog-sub {
  font-size: 0.84rem;
  color: var(--grey-600);
}

.stat-row {
  display: flex;
  gap: 12px;
}

.stat {
  flex: 1;
  text-align: center;
  border: 1px solid var(--grey-200);
  border-radius: var(--radius-sm);
  padding: 10px 6px;
}

.stat__value {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.6rem;
  line-height: 1;
  color: var(--navy-800);
}

.stat__label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--grey-500);
  margin-top: 4px;
}

.detail-block {
  margin-top: 14px;
}

.detail-block__head {
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--grey-500);
  margin-bottom: 6px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 4px 12px;
  font-size: 0.88rem;
  color: var(--grey-600);
}

.detail-grid span {
  font-weight: 700;
  color: var(--navy-800);
}

.detail-none,
.attention {
  margin-top: 12px;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--grey-600);
}

.block-label {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--grey-500);
  margin-bottom: 8px;
}

.bout-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.bout {
  padding: 8px;
  margin: 0 -8px;
  border-top: 1px solid var(--grey-200);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.bout:hover {
  background: var(--grey-050, #fafafa);
}

/* A ring, not just a tint: the tint alone is too faint to find with a keyboard. */
.bout:focus-visible {
  background: var(--grey-050, #fafafa);
  outline: 2px solid var(--navy-800);
  outline-offset: -2px;
}

.bout:first-child {
  border-top: none;
}

.bout__main {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.bout__result {
  font-weight: 600;
  color: var(--grey-600);
}

.bout__result--win {
  color: var(--navy-800);
}

.bout__score {
  font-size: 0.9rem;
  color: var(--grey-500);
}

.bout__meta {
  font-size: 0.8rem;
  color: var(--grey-500);
}

.bout__flag {
  font-size: 0.76rem;
  color: var(--negative, #c10015);
  margin-top: 2px;
}
</style>
