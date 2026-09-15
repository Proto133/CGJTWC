<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMeta } from 'quasar'
import { useWrestlersStore } from 'stores/wrestlers'
import { useMatchesStore } from 'stores/matches'
import { useEventsStore } from 'stores/events'
import {
  scoreFromEvents,
  suggestWinType,
  undoLast,
} from 'src/utils/matchScoring'
import { currentSeason } from 'src/utils/season'
import type { MatchEvent, MatchEventType, MatchWinType, Wrestler } from 'src/types'

/**
 * Live bout scoring.
 *
 * Nothing is written while the bout is in progress. The log lives in local
 * state and is drafted to local storage after every tap, then saved as one
 * document at End Match. Gyms have dreadful signal, and a screen that needs
 * nothing from the network until the bout is over cannot be interrupted by it.
 *
 * The tally is a best-effort second screen. The table's score is authoritative,
 * which is why End Match asks for it rather than assuming ours is right.
 */

const wrestlersStore = useWrestlersStore()
const matchesStore = useMatchesStore()
const eventsStore = useEventsStore()

const season = currentSeason()

type Stage = 'pick' | 'scoring' | 'finish'
const stage = ref<Stage>('pick')

const wrestlerId = ref<string | null>(null)
const opponentName = ref('')
const opponentTeam = ref('')
const weightClass = ref('')
const round = ref('')
const eventId = ref<string | null>(null)

const events = ref<MatchEvent[]>([])
const period = ref(1)

// Finish-stage fields
const winType = ref<MatchWinType>('decision')
const result = ref<'win' | 'loss'>('win')
const officialFor = ref<number | null>(null)
const officialAgainst = ref<number | null>(null)

onMounted(() => {
  wrestlersStore.subscribe()
  eventsStore.subscribe()
  restoreDraft()
})

onBeforeUnmount(() => {
  wrestlersStore.unsubscribeFromWrestlers()
  eventsStore.unsubscribeFromEvents()
})

const wrestler = computed<Wrestler | null>(() =>
  wrestlerId.value ? wrestlersStore.byId(wrestlerId.value) : null)

const wrestlerName = computed(() =>
  wrestler.value ? `${wrestler.value.firstName} ${wrestler.value.lastName}` : '')

const score = computed(() => scoreFromEvents(events.value))

/** Upcoming and recent events, so a tournament can be attached without typing. */
const eventOptions = computed(() =>
  eventsStore.events
    .filter((e) => e.type !== 'practice')
    .map((e) => ({ label: `${e.title}`, value: e.id })))

// ---------------------------------------------------------------------------
// Draft persistence
// ---------------------------------------------------------------------------

/**
 * A bout in progress survives a reload or a dropped phone.
 *
 * Written after every tap. Losing a bout to a locked screen halfway through the
 * third period would be worse than not having the feature.
 */
const DRAFT_KEY = 'score-draft-v1'

function saveDraft() {
  if (stage.value === 'pick') return
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      stage: stage.value,
      wrestlerId: wrestlerId.value,
      opponentName: opponentName.value,
      opponentTeam: opponentTeam.value,
      weightClass: weightClass.value,
      round: round.value,
      eventId: eventId.value,
      events: events.value,
      period: period.value,
    }))
  } catch {
    // Storage unavailable. The bout still works, it just will not survive a reload.
  }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    const draft = JSON.parse(raw) as Record<string, unknown>
    stage.value = (draft.stage as Stage) ?? 'pick'
    wrestlerId.value = (draft.wrestlerId as string) ?? null
    opponentName.value = (draft.opponentName as string) ?? ''
    opponentTeam.value = (draft.opponentTeam as string) ?? ''
    weightClass.value = (draft.weightClass as string) ?? ''
    round.value = (draft.round as string) ?? ''
    eventId.value = (draft.eventId as string) ?? null
    events.value = (draft.events as MatchEvent[]) ?? []
    period.value = (draft.period as number) ?? 1
  } catch {
    clearDraft()
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Nothing to do.
  }
}

watch([events, period, stage], saveDraft, { deep: true })

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * The buttons, in the order a scorer reaches for them.
 *
 * Labels are the shorthand called on the mat rather than prose: there is no
 * time to read "near fall, three points" between scrambles.
 */
const CALLS: { type: MatchEventType; label: string; hint: string }[] = [
  { type: 'takedown', label: 'T', hint: 'Takedown' },
  { type: 'escape', label: 'E', hint: 'Escape' },
  { type: 'reversal', label: 'R', hint: 'Reversal' },
  { type: 'nearFall2', label: 'N2', hint: 'Near fall 2' },
  { type: 'nearFall3', label: 'N3', hint: 'Near fall 3' },
  { type: 'nearFall4', label: 'N4', hint: 'Near fall 4' },
]

/** Called on the offender, which is how the official says it. */
const INFRACTION_CALLS: { type: MatchEventType; label: string; hint: string }[] = [
  { type: 'stallWarning', label: 'Stall', hint: 'Warning, no points' },
  { type: 'stallPoint', label: 'Stall pt', hint: 'Stalling point' },
  { type: 'penalty1', label: 'P1', hint: 'Penalty, 1' },
  { type: 'penalty2', label: 'P2', hint: 'Penalty, 2' },
]

function record(type: MatchEventType, side: 'wrestler' | 'opponent') {
  events.value = [...events.value, { type, side, period: period.value }]
}

function undo() {
  events.value = undoLast(events.value)
}

function startBout() {
  if (!wrestlerId.value) return
  events.value = []
  period.value = 1
  stage.value = 'scoring'
}

function endPeriod() {
  period.value += 1
}

function endMatch() {
  const derived = score.value
  // Prefilled from the tally so the common case is one tap, but every field
  // stays editable because the table's sheet is what counts.
  officialFor.value = derived.for
  officialAgainst.value = derived.against
  result.value = derived.for >= derived.against ? 'win' : 'loss'
  winType.value = suggestWinType(derived)
  stage.value = 'finish'
}

const tallyDisagrees = computed(() =>
  officialFor.value !== score.value.for || officialAgainst.value !== score.value.against)

async function save() {
  if (!wrestlerId.value) return

  const chosen = eventId.value
    ? eventsStore.events.find((e) => e.id === eventId.value)
    : null

  const id = await matchesStore.add({
    wrestlerId: wrestlerId.value,
    season,
    date: chosen ? chosen.date.toDate() : new Date(),
    result: result.value,
    winType: winType.value,
    events: events.value,
    ...(eventId.value ? { eventId: eventId.value } : {}),
    // Snapshotted: events can be deleted, and a bout with only a dangling id
    // would lose its label entirely.
    ...(chosen ? { eventName: chosen.title } : {}),
    ...(opponentName.value ? { opponentName: opponentName.value.trim() } : {}),
    ...(opponentTeam.value ? { opponentTeam: opponentTeam.value.trim() } : {}),
    ...(weightClass.value ? { weightClass: weightClass.value.trim() } : {}),
    ...(round.value ? { round: round.value.trim() } : {}),
    ...(officialFor.value !== null ? { officialFor: officialFor.value } : {}),
    ...(officialAgainst.value !== null ? { officialAgainst: officialAgainst.value } : {}),
  })

  if (id) reset()
}

function reset() {
  clearDraft()
  stage.value = 'pick'
  events.value = []
  period.value = 1
  opponentName.value = ''
  opponentTeam.value = ''
  round.value = ''
  officialFor.value = null
  officialAgainst.value = null
}

function discard() {
  reset()
}

useMeta({ title: 'Score a bout' })
</script>

<template>
  <div class="score-shell">
    <!-- PICK -->
    <section v-if="stage === 'pick'" class="score-pick">
      <h1 class="score-title">Score a bout</h1>

      <q-select
        v-model="wrestlerId"
        :options="wrestlersStore.activeRoster.map((w) => ({
          label: `${w.lastName}, ${w.firstName}`,
          value: w.id,
        }))"
        label="Wrestler *"
        outlined
        emit-value
        map-options
        dark
        class="q-mb-md"
      />

      <div v-if="wrestlersStore.activeRoster.length === 0" class="score-empty">
        No wrestlers on the roster yet. Add them in the dashboard first.
      </div>

      <q-select
        v-model="eventId"
        :options="eventOptions"
        label="Event"
        outlined
        emit-value
        map-options
        clearable
        dark
        class="q-mb-md"
      />

      <div class="row q-col-gutter-sm">
        <div class="col-12 col-sm-6">
          <q-input v-model="opponentName" label="Opponent" outlined dark />
        </div>
        <div class="col-12 col-sm-6">
          <q-input v-model="opponentTeam" label="Their club" outlined dark />
        </div>
        <div class="col-6">
          <q-input v-model="weightClass" label="Weight" outlined dark />
        </div>
        <div class="col-6">
          <q-input v-model="round" label="Round" outlined dark />
        </div>
      </div>

      <q-btn
        class="full-width q-mt-lg score-start"
        color="primary"
        unelevated
        no-caps
        size="lg"
        label="Start match"
        :disable="!wrestlerId"
        @click="startBout"
      />
    </section>

    <!-- SCORING -->
    <section v-else-if="stage === 'scoring'" class="score-live">
      <header class="score-head">
        <div class="score-head__names">
          <span class="score-head__us">{{ wrestlerName }}</span>
          <span class="score-head__them">{{ opponentName || 'Opponent' }}</span>
        </div>
        <div class="score-head__score">
          <span class="score-head__num">{{ score.for }}</span>
          <span class="score-head__dash">–</span>
          <span class="score-head__num">{{ score.against }}</span>
        </div>
        <div class="score-head__period">Period {{ period }}</div>
      </header>

      <!-- Two columns, our wrestler on the left, matching how a scorer faces
           the mat. Scoring calls are tapped in the column of whoever scored;
           infractions in the column of whoever they were called on. -->
      <div class="call-grid">
        <div class="call-col">
          <button
            v-for="call in CALLS"
            :key="`us-${call.type}`"
            type="button"
            class="call-btn"
            :title="call.hint"
            @click="record(call.type, 'wrestler')"
          >{{ call.label }}</button>
        </div>
        <div class="call-col">
          <button
            v-for="call in CALLS"
            :key="`them-${call.type}`"
            type="button"
            class="call-btn call-btn--them"
            :title="call.hint"
            @click="record(call.type, 'opponent')"
          >{{ call.label }}</button>
        </div>
      </div>

      <div class="call-note">Infractions — tap on whoever it was called against</div>
      <div class="call-grid call-grid--small">
        <div class="call-col">
          <button
            v-for="call in INFRACTION_CALLS"
            :key="`us-${call.type}`"
            type="button"
            class="call-btn call-btn--infraction"
            :title="call.hint"
            @click="record(call.type, 'wrestler')"
          >{{ call.label }}</button>
        </div>
        <div class="call-col">
          <button
            v-for="call in INFRACTION_CALLS"
            :key="`them-${call.type}`"
            type="button"
            class="call-btn call-btn--infraction call-btn--them"
            :title="call.hint"
            @click="record(call.type, 'opponent')"
          >{{ call.label }}</button>
        </div>
      </div>

      <div class="score-actions">
        <q-btn
          flat
          no-caps
          color="white"
          icon="undo"
          label="Undo"
          :disable="events.length === 0"
          @click="undo"
        />
        <q-btn flat no-caps color="white" label="End period" @click="endPeriod" />
        <q-space />
        <q-btn unelevated no-caps color="primary" label="End match" @click="endMatch" />
      </div>

      <div class="score-log">
        {{ events.length }} call{{ events.length === 1 ? '' : 's' }} recorded
      </div>
    </section>

    <!-- FINISH -->
    <section v-else class="score-finish">
      <h1 class="score-title">Finish bout</h1>
      <p class="score-sub">
        {{ wrestlerName }} vs {{ opponentName || 'opponent' }} — our tally says
        {{ score.for }}–{{ score.against }}.
      </p>

      <div class="row q-col-gutter-sm">
        <div class="col-6">
          <q-input
            v-model.number="officialFor"
            type="number"
            label="Official — ours"
            outlined
            dark
          />
        </div>
        <div class="col-6">
          <q-input
            v-model.number="officialAgainst"
            type="number"
            label="Official — theirs"
            outlined
            dark
          />
        </div>
      </div>

      <!-- Surfaced rather than reconciled silently: the table's sheet is what
           counts, and a disagreement means the breakdown is suspect. -->
      <div v-if="tallyDisagrees" class="score-warn">
        <q-icon name="warning" size="16px" class="q-mr-xs" />
        That differs from our tally. The official score is kept as the result;
        the breakdown will be flagged as not reconciling.
      </div>

      <q-select
        v-model="result"
        :options="[{ label: 'Win', value: 'win' }, { label: 'Loss', value: 'loss' }]"
        label="Result"
        outlined
        emit-value
        map-options
        dark
        class="q-mt-md"
      />

      <q-select
        v-model="winType"
        :options="[
          { label: 'Decision', value: 'decision' },
          { label: 'Major decision', value: 'majorDecision' },
          { label: 'Technical fall', value: 'techFall' },
          { label: 'Fall', value: 'fall' },
          { label: 'Forfeit', value: 'forfeit' },
          { label: 'Injury default', value: 'injuryDefault' },
          { label: 'Disqualification', value: 'disqualification' },
          { label: 'Bye', value: 'bye' },
        ]"
        label="How it ended"
        hint="Suggested from the score. A fall or injury default can happen at any score."
        outlined
        emit-value
        map-options
        dark
        class="q-mt-md"
      />

      <div class="row q-gutter-sm q-mt-lg">
        <q-btn flat no-caps color="white" label="Back" @click="stage = 'scoring'" />
        <q-space />
        <q-btn flat no-caps color="negative" label="Discard" @click="discard" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Save bout"
          :loading="matchesStore.saving"
          @click="save"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
/*
 * Dark throughout. This is read at arm's length in a bright gym, and a white
 * screen at full brightness is harder to glance at than a dark one.
 */
.score-shell {
  min-height: 100vh;
  background: var(--navy-900);
  color: #fff;
  padding: 16px;
}

.score-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  text-transform: uppercase;
  color: #fff;
  margin: 0 0 16px;
}

.score-sub {
  color: rgba(255, 255, 255, 0.75);
  margin: 0 0 16px;
  font-size: 0.95rem;
}

.score-empty {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.88rem;
  margin-bottom: 16px;
}

.score-start {
  padding: 14px 0;
}

/* Scoreboard ------------------------------------------------------------ */

.score-head {
  text-align: center;
  margin-bottom: 14px;
}

.score-head__names {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2px;
}

.score-head__us,
.score-head__them {
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-head__score {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 14px;
  font-family: var(--font-display);
  font-weight: 700;
  /* Deliberately huge: readable from a seat, not just in the hand. */
  font-size: clamp(3rem, 18vw, 5rem);
  line-height: 1;
}

.score-head__dash {
  font-size: 0.5em;
  color: rgba(255, 255, 255, 0.4);
}

.score-head__period {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 4px;
}

/* Calls ----------------------------------------------------------------- */

.call-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.call-col {
  display: grid;
  gap: 8px;
}

.call-btn {
  appearance: none;
  font: inherit;
  font-family: var(--font-display);
  font-weight: 700;
  /* Large enough to hit without looking down mid-scramble. */
  font-size: 1.5rem;
  padding: 16px 0;
  border-radius: var(--radius-md);
  border: 2px solid rgba(255, 255, 255, 0.25);
  background: var(--navy-700);
  color: #fff;
  cursor: pointer;
}

.call-btn:active {
  background: var(--navy-600);
  transform: scale(0.97);
}

.call-btn--them {
  background: rgba(255, 255, 255, 0.08);
}

.call-btn--infraction {
  font-size: 1rem;
  padding: 10px 0;
}

.call-grid--small {
  margin-top: 6px;
}

.call-note {
  margin-top: 16px;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
}

.score-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 18px;
}

.score-log {
  margin-top: 10px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
}

.score-warn {
  margin-top: 10px;
  font-size: 0.84rem;
  line-height: 1.5;
  color: #ffd27a;
}
</style>
