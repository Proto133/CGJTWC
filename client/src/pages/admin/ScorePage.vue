<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMeta } from 'quasar'
import { useWrestlersStore } from 'stores/wrestlers'
import { useMatchesStore } from 'stores/matches'
import { useEventsStore } from 'stores/events'
import {
  STALL_DQ_AT,
  nextStallCall,
  scoreFromEvents,
  stallConsequence,
  stallCount,
  suggestWinType,
  undoLast,
} from 'src/utils/matchScoring'
import { WIN_TYPE_OPTIONS } from 'src/utils/wrestlerStats'
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

/**
 * Which ankle band our wrestler is wearing.
 *
 * Declared before the bout starts rather than assumed, because the whole
 * screen keys off it. A scorer watching the mat sees two colours, not "us" and
 * "them", and a column that does not match the band they are looking at is a
 * column they will tap wrong.
 */
type Band = 'red' | 'green'
const ourBand = ref<Band | null>(null)
const theirBand = computed<Band>(() => (ourBand.value === 'red' ? 'green' : 'red'))

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
/** Why the bout ended, when it ended itself rather than being ended by hand. */
const finishNote = ref('')

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
      ourBand: ourBand.value,
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
    // Older drafts predate the band, so a restored bout may have none. Red is
    // the safer default of the two: it is the first band called.
    ourBand.value = (draft.ourBand as Band) ?? 'red'
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

watch([events, period, stage, ourBand], saveDraft, { deep: true })

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
  { type: 'penalty1', label: 'P1', hint: 'Penalty, 1' },
  { type: 'penalty2', label: 'P2', hint: 'Penalty, 2' },
]

function record(type: MatchEventType, side: 'wrestler' | 'opponent') {
  events.value = [...events.value, { type, side, period: period.value }]
}

// ---------------------------------------------------------------------------
// Stalling
// ---------------------------------------------------------------------------

/**
 * One button per side rather than one per rung.
 *
 * Stalling is priced by how many that wrestler already has, and a scorer
 * tracking that in their head while watching the mat will get it wrong. The
 * official calls "stalling" and nothing else, so that is what the button says;
 * which rung it lands on is worked out here.
 */
const stalls = computed(() => ({
  wrestler: stallCount(events.value, 'wrestler'),
  opponent: stallCount(events.value, 'opponent'),
}))

const PIPS = Array.from({ length: STALL_DQ_AT }, (_, i) => i + 1)

function recordStall(side: 'wrestler' | 'opponent') {
  const prior = stalls.value[side]
  // Already disqualified. The bout is over; further taps are noise.
  if (prior >= STALL_DQ_AT) return

  record(nextStallCall(prior), side)

  if (prior + 1 >= STALL_DQ_AT) endByStalling(side)
}

/** The fifth call ends the bout, so the finish screen opens already filled in. */
function endByStalling(offender: 'wrestler' | 'opponent') {
  const derived = score.value
  officialFor.value = derived.for
  officialAgainst.value = derived.against
  result.value = offender === 'wrestler' ? 'loss' : 'win'
  winType.value = 'disqualification'
  finishNote.value = offender === 'wrestler'
    ? `Fifth stalling call on ${wrestlerName.value || 'our wrestler'} \u2014 disqualified.`
    : 'Fifth stalling call on the opponent \u2014 disqualified.'
  stage.value = 'finish'
}

function undo() {
  events.value = undoLast(events.value)
}

function startBout() {
  if (!wrestlerId.value || !ourBand.value) return
  events.value = []
  period.value = 1
  stage.value = 'scoring'
}

/** Periods 1–3, then overtime continues the sequence. */
const periodLabel = computed(() =>
  period.value <= 3 ? `Period ${period.value}` : `Overtime ${period.value - 3}`)

const endPeriodLabel = computed(() => {
  if (period.value < 3) return `End period ${period.value}`
  if (period.value === 3) return 'Go to overtime'
  return 'Next overtime'
})

function endPeriod() {
  period.value += 1
}

/** Undo only truncates the call log, so a mis-tapped period needs its own way back. */
function backPeriod() {
  if (period.value > 1) period.value -= 1
}

function endMatch() {
  const derived = score.value
  finishNote.value = ''
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
  // Cleared rather than carried over: the next bout is a different draw and
  // inheriting the last one's band is how a whole bout gets scored backwards.
  ourBand.value = null
  opponentName.value = ''
  opponentTeam.value = ''
  round.value = ''
  officialFor.value = null
  officialAgainst.value = null
  finishNote.value = ''
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

      <!-- Required, not defaulted. Guessing this wrong scores the whole bout
           on the wrong side, and there is no way to tell afterwards. -->
      <div class="band-pick">
        <div class="band-pick__label">Our wrestler's band *</div>
        <div class="band-pick__row">
          <button
            type="button"
            class="band-opt band-opt--red"
            :class="{ 'band-opt--on': ourBand === 'red' }"
            :aria-pressed="ourBand === 'red'"
            @click="ourBand = 'red'"
          >Red</button>
          <button
            type="button"
            class="band-opt band-opt--green"
            :class="{ 'band-opt--on': ourBand === 'green' }"
            :aria-pressed="ourBand === 'green'"
            @click="ourBand = 'green'"
          >Green</button>
        </div>
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
        :disable="!wrestlerId || !ourBand"
        @click="startBout"
      />
    </section>

    <!-- SCORING -->
    <section v-else-if="stage === 'scoring'" class="score-live">
      <header class="score-head">
        <div class="score-head__row">
          <div class="score-side" :class="`score-side--${ourBand}`">
            <div class="score-side__band">{{ ourBand }}</div>
            <div class="score-side__name">{{ wrestlerName }}</div>
            <div class="score-side__num">{{ score.for }}</div>
            <!-- Five pips, because the fifth stalling call disqualifies. The
                 last one is drawn apart and in red: it is not another point,
                 it ends the bout. -->
            <div
              class="pips"
              :aria-label="`${stalls.wrestler} of ${STALL_DQ_AT} stalling calls`"
            >
              <span
                v-for="n in PIPS"
                :key="`us-${n}`"
                class="pip"
                :class="{
                  'pip--on': stalls.wrestler >= n,
                  'pip--last': n === STALL_DQ_AT,
                }"
              />
            </div>
          </div>
          <div class="score-side" :class="`score-side--${theirBand}`">
            <div class="score-side__band">{{ theirBand }}</div>
            <div class="score-side__name">{{ opponentName || 'Opponent' }}</div>
            <div class="score-side__num">{{ score.against }}</div>
            <div
              class="pips"
              :aria-label="`${stalls.opponent} of ${STALL_DQ_AT} stalling calls`"
            >
              <span
                v-for="n in PIPS"
                :key="`them-${n}`"
                class="pip"
                :class="{
                  'pip--on': stalls.opponent >= n,
                  'pip--last': n === STALL_DQ_AT,
                }"
              />
            </div>
          </div>
        </div>
        <div class="score-head__period">
          <q-btn
            v-if="period > 1"
            dense
            flat
            round
            size="sm"
            color="white"
            icon="chevron_left"
            aria-label="Back a period"
            @click="backPeriod"
          />
          {{ periodLabel }}
        </div>
      </header>

      <!-- Columns are the two bands, not "us" and "them". Ours stays on the
           left so the layout never moves, but it wears whichever colour was
           declared. Filled buttons add points to that colour. -->
      <div class="call-grid">
        <div class="call-col">
          <button
            v-for="call in CALLS"
            :key="`us-${call.type}`"
            type="button"
            class="call-btn"
            :class="`call-btn--${ourBand}`"
            :title="call.hint"
            :aria-label="`${call.hint}, ${ourBand}`"
            @click="record(call.type, 'wrestler')"
          >{{ call.label }}</button>
        </div>
        <div class="call-col">
          <button
            v-for="call in CALLS"
            :key="`them-${call.type}`"
            type="button"
            class="call-btn"
            :class="`call-btn--${theirBand}`"
            :title="call.hint"
            :aria-label="`${call.hint}, ${theirBand}`"
            @click="record(call.type, 'opponent')"
          >{{ call.label }}</button>
        </div>
      </div>

      <!-- Outlined rather than filled, because these are the one set of
           buttons that do NOT score for the colour they sit under. Tap them on
           the offender, as the official calls it; the point goes the other way. -->
      <div class="call-note">Infractions — tap on the offender, the point goes the other way</div>

      <!-- One stall button per side. What it costs is worked out from the count
           and shown under the label, so the scorer never has to remember the
           chart mid-bout. -->
      <div class="call-grid call-grid--small">
        <button
          type="button"
          class="call-btn call-btn--infraction stall-btn"
          :class="[
            `call-btn--on-${ourBand}`,
            { 'stall-btn--final': stalls.wrestler === STALL_DQ_AT - 1 },
          ]"
          :disabled="stalls.wrestler >= STALL_DQ_AT"
          :aria-label="`Stalling on ${ourBand}: ${stallConsequence(stalls.wrestler)}`"
          @click="recordStall('wrestler')"
        >
          Stall
          <span class="stall-btn__next">{{ stallConsequence(stalls.wrestler) }}</span>
        </button>
        <button
          type="button"
          class="call-btn call-btn--infraction stall-btn"
          :class="[
            `call-btn--on-${theirBand}`,
            { 'stall-btn--final': stalls.opponent === STALL_DQ_AT - 1 },
          ]"
          :disabled="stalls.opponent >= STALL_DQ_AT"
          :aria-label="`Stalling on ${theirBand}: ${stallConsequence(stalls.opponent)}`"
          @click="recordStall('opponent')"
        >
          Stall
          <span class="stall-btn__next">{{ stallConsequence(stalls.opponent) }}</span>
        </button>
      </div>
      <div class="call-grid call-grid--small">
        <div class="call-col">
          <button
            v-for="call in INFRACTION_CALLS"
            :key="`us-${call.type}`"
            type="button"
            class="call-btn call-btn--infraction"
            :class="`call-btn--on-${ourBand}`"
            :title="call.hint"
            :aria-label="`${call.hint}, called on ${ourBand}`"
            @click="record(call.type, 'wrestler')"
          >{{ call.label }}</button>
        </div>
        <div class="call-col">
          <button
            v-for="call in INFRACTION_CALLS"
            :key="`them-${call.type}`"
            type="button"
            class="call-btn call-btn--infraction"
            :class="`call-btn--on-${theirBand}`"
            :title="call.hint"
            :aria-label="`${call.hint}, called on ${theirBand}`"
            @click="record(call.type, 'opponent')"
          >{{ call.label }}</button>
        </div>
      </div>

      <div class="score-actions">
        <q-btn
          outline
          no-caps
          color="white"
          icon="undo"
          label="Undo"
          :disable="events.length === 0"
          @click="undo"
        />
        <q-btn
          outline
          no-caps
          color="white"
          icon="timer"
          :label="endPeriodLabel"
          @click="endPeriod"
        />
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
      <p v-if="finishNote" class="score-reason">
        <q-icon name="gavel" size="16px" class="q-mr-xs" />{{ finishNote }}
      </p>
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
        :options="WIN_TYPE_OPTIONS"
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

  /*
   * The mat's own colours. Fills carry white text; the lighter "ink" variants
   * are for text and borders, where the saturated fill colours would not clear
   * the contrast threshold against navy.
   *
   * Red and green together is the worst pairing for colour blindness, which is
   * roughly one man in twelve. It is also what is physically strapped to the
   * wrestlers' ankles, so substituting friendlier colours would make the screen
   * disagree with the mat. Every coloured element is therefore labelled "Red"
   * or "Green" in words as well, and the columns never swap position.
   */
  --band-red: #c62431;
  --band-red-ink: #ff8a94;
  --band-green: #14803c;
  --band-green-ink: #5fd98a;
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

/* Band selection -------------------------------------------------------- */

.band-pick {
  margin-bottom: 16px;
}

.band-pick__label {
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 6px;
}

.band-pick__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.band-opt {
  appearance: none;
  font: inherit;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 14px 0;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
}

.band-opt--red {
  border: 2px solid var(--band-red-ink);
  color: var(--band-red-ink);
}

.band-opt--green {
  border: 2px solid var(--band-green-ink);
  color: var(--band-green-ink);
}

/* Selection is a fill, not a tint: this is the one choice on the screen
   that cannot be recovered from afterwards. */
.band-opt--red.band-opt--on {
  background: var(--band-red);
  border-color: var(--band-red);
  color: #fff;
}

.band-opt--green.band-opt--on {
  background: var(--band-green);
  border-color: var(--band-green);
  color: #fff;
}

/* Scoreboard ------------------------------------------------------------ */

.score-head {
  text-align: center;
  margin-bottom: 14px;
}

.score-head__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

/* Each side sits over its own column of buttons, so the eye never has to
   work out which score belongs to which half of the screen. */
.score-side {
  border-top: 4px solid;
  padding-top: 6px;
  min-width: 0;
}

.score-side--red {
  border-color: var(--band-red);
}

.score-side--green {
  border-color: var(--band-green);
}

.score-side__band {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.score-side--red .score-side__band,
.score-side--red .score-side__num {
  color: var(--band-red-ink);
}

.score-side--green .score-side__band,
.score-side--green .score-side__num {
  color: var(--band-green-ink);
}

.score-side__name {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-side__num {
  font-family: var(--font-display);
  font-weight: 700;
  /* Deliberately huge: readable from a seat, not just in the hand. */
  font-size: clamp(2.6rem, 16vw, 4.5rem);
  line-height: 1;
}

/* Stalling count ---------------------------------------------------------
 *
 * Sits under the score because that is where the eye already is, and because
 * the count matters most in the moment when the score does.
 */
.pips {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  min-height: 12px;
}

.pip {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.35);
}

.pip--on {
  background: #fff;
  border-color: #fff;
}

/* The fifth is set apart and outlined in red, filled or not: it is not another
   point on the board, it is the end of the bout. */
.pip--last {
  margin-left: 5px;
  border-color: var(--band-red-ink);
}

.pip--last.pip--on {
  background: var(--band-red-ink);
}

.score-head__period {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 8px;
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
  border: 2px solid transparent;
  background: var(--navy-700);
  color: #fff;
  cursor: pointer;
}

.call-btn:active {
  transform: scale(0.97);
  filter: brightness(1.25);
}

/* Filled: a tap here puts points on this colour. */
.call-btn--red {
  background: var(--band-red);
}

.call-btn--green {
  background: var(--band-green);
}

/* Outlined: called ON this colour, and the point goes to the other one. The
   difference in treatment is the only thing stopping a scorer from reading
   these as "green scored" at a glance. */
.call-btn--infraction {
  font-size: 1rem;
  padding: 10px 0;
  background: transparent;
}

.call-btn--on-red {
  border-color: var(--band-red-ink);
  color: var(--band-red-ink);
}

.call-btn--on-green {
  border-color: var(--band-green-ink);
  color: var(--band-green-ink);
}

.call-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

/* Stalling -------------------------------------------------------------- */

.stall-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  line-height: 1.1;
}

/* What the next call costs, read straight off the chart. */
.stall-btn__next {
  font-family: var(--font-body, inherit);
  font-weight: 400;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.85;
}

/* One more ends it. Worth shouting about before it is tapped, not after. */
.stall-btn--final {
  border-color: var(--band-red-ink);
  color: var(--band-red-ink);
  background: rgba(198, 36, 49, 0.18);
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

.score-reason {
  display: flex;
  align-items: center;
  margin: -8px 0 12px;
  font-size: 0.9rem;
  color: var(--band-red-ink);
}
</style>
