<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMatchesStore } from 'stores/matches'
import { useWrestlersStore } from 'stores/wrestlers'
import MatchEditDialog from 'components/admin/MatchEditDialog.vue'
import { eventTeamPoints } from 'src/utils/wrestlerStats'
import { resultLabel } from 'src/utils/matchLabels'
import type { Event, Match } from 'src/types'

/**
 * How the club did at one event.
 *
 * This view is the reason matches sit in a top-level collection rather than
 * under each wrestler: asking the question by event is an ordinary query.
 */

const props = defineProps<{
  modelValue: boolean
  event: Event | null
}>()

const emit = defineEmits<{ (e: 'update:modelValue', open: boolean): void }>()

const matchesStore = useMatchesStore()
const wrestlersStore = useWrestlersStore()

const bouts = computed<Match[]>(() => {
  if (!props.event) return []
  return [...matchesStore.forEvent(props.event.id)]
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
})

/**
 * Falls back to the stored opponent rather than an id when a wrestler has been
 * removed from the roster, so a deleted entry does not blank out its results.
 */
function nameOf(match: Match): string {
  const wrestler = wrestlersStore.byId(match.wrestlerId)
  return wrestler ? `${wrestler.lastName}, ${wrestler.firstName}` : 'Unknown wrestler'
}

const wins = computed(() =>
  bouts.value.filter((b) => b.result === 'win' && b.winType !== 'bye').length)
const losses = computed(() =>
  bouts.value.filter((b) => b.result === 'loss' && b.winType !== 'bye').length)
const points = computed(() => eventTeamPoints(bouts.value))

function score(match: Match): string {
  if (typeof match.officialFor !== 'number') return ''
  return `${match.officialFor}\u2013${match.officialAgainst ?? 0}`
}

const editOpen = ref(false)
const editing = ref<Match | null>(null)

function openEdit(match: Match) {
  editing.value = match
  editOpen.value = true
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card v-if="event" class="results-card">
      <q-card-section>
        <div class="dialog-title">{{ event.title }}</div>
        <div class="dialog-sub">Club results</div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="stat-row">
          <div class="stat">
            <div class="stat__value">{{ wins }}–{{ losses }}</div>
            <div class="stat__label">Record</div>
          </div>
          <div class="stat">
            <div class="stat__value">{{ bouts.length }}</div>
            <div class="stat__label">Bouts</div>
          </div>
          <div class="stat">
            <div class="stat__value">{{ points }}</div>
            <div class="stat__label">Team pts</div>
          </div>
        </div>

        <!-- Worth stating plainly: these are NFHS dual points from the win
             types recorded here, not the tournament's own team score, which is
             calculated differently and includes placement. -->
        <div class="stat-note">
          Team points are NFHS dual scoring from the results below. A tournament
          scores placement separately.
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div v-if="bouts.length === 0" class="empty-state">
          No bouts recorded for this event yet.
        </div>

        <!-- Same as the roster view: tapping a bout opens it for correction,
             because this is where a wrong entry gets noticed. -->
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
            <div class="bout__name">{{ nameOf(bout) }}</div>
            <div class="bout__detail">
              <span :class="{
                'bout__win': bout.result === 'win' && bout.winType !== 'bye',
              }">{{ resultLabel(bout) }}</span>
              <template v-if="score(bout)"> · {{ score(bout) }}</template>
              <template v-if="bout.opponentName"> · vs {{ bout.opponentName }}</template>
              <template v-if="bout.weightClass"> · {{ bout.weightClass }}</template>
            </div>
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
.results-card {
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

.stat-note {
  margin-top: 10px;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--grey-500);
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

.bout__name {
  font-weight: 600;
  color: var(--navy-800);
}

.bout__detail {
  font-size: 0.84rem;
  color: var(--grey-500);
}

.bout__win {
  color: var(--navy-800);
  font-weight: 600;
}
</style>
