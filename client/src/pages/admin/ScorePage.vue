<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMeta } from 'quasar'
import { useWrestlersStore } from 'stores/wrestlers'
import { useMatchesStore } from 'stores/matches'
import { useEventsStore } from 'stores/events'
import {
  STALL_DQ_AT,
  SUDDEN_VICTORY_PERIOD,
  TECH_FALL_MARGIN,
  TIEBREAKER_PERIOD,
  cautionConsequence,
  cautionConsequenceShort,
  cautionCount,
  isChoice,
  isInfraction,
  isValidEndTime,
  needsEndTime,
  nextCautionCall,
  nextStallCall,
  scoreFromEvents,
  stallConsequence,
  stallConsequenceShort,
  stallCount,
  suggestWinType,
  undoLast,
} from 'src/utils/matchScoring'
import {
  WIN_TYPE_OPTIONS,
  eventLabel,
  eventName,
  periodLabel,
  periodName,
  winTypeLabel,
} from 'src/utils/matchLabels'
import BoxScoreDialog from 'components/admin/BoxScoreDialog.vue'
import PeriodChoiceDialog from 'components/admin/PeriodChoiceDialog.vue'
import FallDialog from 'components/admin/FallDialog.vue'
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
/**
 * When the bout stopped, for the endings that stop it early.
 *
 * 'M:SS' left on the clock, and which period. Required before saving any of
 * those endings, because nobody reconstructs it later from a bracket.
 */
const endPeriod = ref<number | null>(null)
const endTime = ref('')

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
 * Labelled with the standard scoresheet marks rather than prose, and drawn
 * from the same table the results screens use: there is no time to read "near
 * fall, three points" between scrambles, and a scorer who learns T3 here
 * should see T3 everywhere afterwards.
 */
const CALLS: MatchEventType[] = [
  'takedown',
  'escape',
  'reversal',
  'nearFall2',
  'nearFall3',
  'nearFall4',
]

function record(type: MatchEventType, side: 'wrestler' | 'opponent') {
  events.value = [...events.value, { type, side, period: period.value }]
  checkTechFall()
}

/**
 * A fifteen-point lead ends the bout there and then.
 *
 * Checked on the way in rather than by watching the score, so undoing back
 * below the margin and stepping forward again behaves sensibly instead of
 * re-firing. The referee stops the match the moment the margin is reached, so
 * the app should not sit waiting to be told.
 */
function checkTechFall() {
  const { for: ours, against: theirs } = scoreFromEvents(events.value)
  const margin = Math.abs(ours - theirs)
  if (margin < TECH_FALL_MARGIN) return

  officialFor.value = ours
  officialAgainst.value = theirs
  result.value = ours > theirs ? 'win' : 'loss'
  winType.value = 'techFall'
  // The period is known; the clock is not, and a technical fall can land on
  // 0:00, so it cannot be inferred from anything and has to be read off.
  endPeriod.value = period.value
  endTime.value = ''
  finishNote.value = `${margin}-point lead \u2014 technical fall.`
  stage.value = 'finish'
}

// ---------------------------------------------------------------------------
// Infractions
// ---------------------------------------------------------------------------

/**
 * Three separate counters, each on its own chart.
 *
 * Stalling, cautions and the general penalty progression are deliberately
 * independent under NFHS, and two of the three are priced by how many came
 * before. A scorer tracking that in their head while watching the mat will get
 * it wrong, so each button says only what the official says — "stalling",
 * "caution" — and works out the rung itself.
 */
const stalls = computed(() => ({
  wrestler: stallCount(events.value, 'wrestler'),
  opponent: stallCount(events.value, 'opponent'),
}))

const cautions = computed(() => ({
  wrestler: cautionCount(events.value, 'wrestler'),
  opponent: cautionCount(events.value, 'opponent'),
}))

const PIPS = Array.from({ length: STALL_DQ_AT }, (_, i) => i + 1)

function recordStall(side: 'wrestler' | 'opponent') {
  const prior = stalls.value[side]
  // Already disqualified. The bout is over; further taps are noise.
  if (prior >= STALL_DQ_AT) return

  record(nextStallCall(prior), side)

  if (prior + 1 >= STALL_DQ_AT) endByStalling(side)
}

function recordCaution(side: 'wrestler' | 'opponent') {
  record(nextCautionCall(cautions.value[side]), side)
}

interface InfractionButton {
  key: string
  icon: string
  /** What this call will cost, from the chart. */
  caption: string
  aria: string
  disabled: boolean
  /** One more ends the bout. */
  final: boolean
  run: () => void
}

/**
 * Built here rather than in the template because each button's label and state
 * depend on the count so far, and four of these repeated across two sides is
 * eight places for the two halves to drift apart.
 */
function infractionsFor(side: 'wrestler' | 'opponent'): InfractionButton[] {
  const band = side === 'wrestler' ? ourBand.value : theirBand.value
  const stallsNow = stalls.value[side]
  const cautionsNow = cautions.value[side]

  return [
    {
      key: 'stall',
      icon: 'hourglass_empty',
      caption: stallConsequenceShort(stallsNow),
      aria: `Stalling on ${band}: ${stallConsequence(stallsNow)}`,
      disabled: stallsNow >= STALL_DQ_AT,
      final: stallsNow === STALL_DQ_AT - 1,
      run: () => recordStall(side),
    },
    {
      key: 'caution',
      icon: 'pan_tool',
      caption: cautionConsequenceShort(cautionsNow),
      aria: `Caution on ${band}: ${cautionConsequence(cautionsNow)}`,
      disabled: false,
      final: false,
      run: () => recordCaution(side),
    },
    {
      key: 'penalty1',
      icon: 'flag',
      caption: '1 pt',
      aria: `Penalty, one point, on ${band}`,
      disabled: false,
      final: false,
      run: () => record('penalty1', side),
    },
    {
      key: 'penalty2',
      icon: 'flag',
      caption: '2 pts',
      aria: `Penalty, two points, on ${band}`,
      disabled: false,
      final: false,
      run: () => record('penalty2', side),
    },
  ]
}

const ourInfractions = computed(() => infractionsFor('wrestler'))
const theirInfractions = computed(() => infractionsFor('opponent'))

// ---------------------------------------------------------------------------
// The tape
// ---------------------------------------------------------------------------

const TAPE_LENGTH = 5

/**
 * The last few calls, oldest to newest.
 *
 * Left to right in the order they happened, which puts the most recent one
 * next to Undo — so the thing that button will remove is the thing beside it.
 */
const recentCalls = computed(() => {
  const start = Math.max(0, events.value.length - TAPE_LENGTH)
  return events.value.slice(start).map((event, i) => ({
    key: start + i,
    label: eventLabel(event.type),
    name: eventName(event.type),
    band: event.side === 'wrestler' ? ourBand.value : theirBand.value,
    infraction: isInfraction(event.type),
  }))
})

const boxScoreOpen = ref(false)

/** The fifth call ends the bout, so the finish screen opens already filled in. */
function endByStalling(offender: 'wrestler' | 'opponent') {
  const derived = score.value
  officialFor.value = derived.for
  officialAgainst.value = derived.against
  result.value = offender === 'wrestler' ? 'loss' : 'win'
  winType.value = 'disqualification'
  endPeriod.value = period.value
  endTime.value = ''
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

const periodTitle = computed(() => periodName(period.value))

/** Abbreviated, because it lives in a narrow column between the scores. */
const periodShort = computed(() => periodLabel(period.value))

/**
 * Named for what comes next rather than what is ending, because in overtime
 * the next thing has a name worth saying: sudden victory, then the tiebreaker.
 */
const endPeriodLabel = computed(() => {
  if (period.value < 3) return `End period ${period.value}`
  if (period.value === 3) return 'Go to sudden victory'
  if (period.value === SUDDEN_VICTORY_PERIOD) return 'Go to the tiebreaker'
  return 'Next period'
})

const endPeriodShort = computed(() => {
  if (period.value < 3) return 'End period'
  if (period.value === 3) return 'Sudden victory'
  if (period.value === SUDDEN_VICTORY_PERIOD) return 'Tiebreaker'
  return 'Next'
})

/**
 * The periods that start from a choice.
 *
 * Sudden victory is missing on purpose: it always starts neutral, so there is
 * nothing to ask. The tiebreaker after it does have one, and it goes to
 * whoever scored first in regulation.
 */
const CHOICE_PERIODS = [2, 3, TIEBREAKER_PERIOD]

const choiceOpen = ref(false)
const choiceFor = ref(2)

function advancePeriod() {
  const next = period.value + 1

  if (CHOICE_PERIODS.includes(next)) {
    choiceFor.value = next
    choiceOpen.value = true
    // The period advances when the question is answered or skipped, so the
    // scoreboard cannot get ahead of the sheet.
    return
  }

  period.value = next
}

function applyChoice(marks: MatchEvent[]) {
  // Skipping leaves whatever was there. It means "do not record", not "erase".
  if (marks.length) {
    // Answering replaces. The period can be stepped back and ended again, and
    // two sets of choice marks on one period would be nonsense on the sheet.
    const cleared = events.value.filter(
      (e) => !(e.period === choiceFor.value && isChoice(e.type)),
    )
    events.value = [...cleared, ...marks]
  }

  period.value = choiceFor.value
}

/** Undo only truncates the call log, so a mis-tapped period needs its own way back. */
function backPeriod() {
  if (period.value > 1) period.value -= 1
}

const fallOpen = ref(false)

/**
 * A fall is the one ending that cannot be inferred from the score, so it gets
 * its own button — and its own confirmation, since a stray tap on it would end
 * a bout that is still being wrestled.
 */
function recordFall(side: 'wrestler' | 'opponent', clock: string) {
  const derived = score.value
  officialFor.value = derived.for
  officialAgainst.value = derived.against
  result.value = side === 'wrestler' ? 'win' : 'loss'
  winType.value = 'fall'
  endPeriod.value = period.value
  endTime.value = clock
  finishNote.value = `Fall at ${clock} of ${periodShort.value}.`
  stage.value = 'finish'
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

const timingRequired = computed(() => needsEndTime(winType.value))
const endTimeValid = computed(() => isValidEndTime(endTime.value))

/**
 * Blocks the save rather than warning about it.
 *
 * This is the one moment the clock is still readable. A bout saved without it
 * cannot be repaired from a bracket later, which is exactly the sort of gap
 * that gets noticed at the end of a season and never filled.
 */
const canSave = computed(() =>
  !timingRequired.value || (endPeriod.value !== null && endTimeValid.value))

// Filled in when the ending changes to one that wants it, so the common case
// is already right and only the clock has to be typed.
watch(timingRequired, (needed) => {
  if (needed && endPeriod.value === null) endPeriod.value = period.value
})

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
    // Only carried on an ending that stopped the clock. On a decision they
    // would be a time that refers to nothing.
    ...(timingRequired.value && endPeriod.value !== null
      ? { endPeriod: endPeriod.value } : {}),
    ...(timingRequired.value && endTimeValid.value ? { endTime: endTime.value } : {}),
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
  endPeriod.value = null
  endTime.value = ''
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
      <q-btn
        flat
        dense
        no-caps
        color="white"
        icon="arrow_back"
        label="Dashboard"
        class="score-leave"
        to="/admin"
      />
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

        <!-- Match controls belong between the scores: it is the one part of the
             board that is neither wrestler's, and it keeps them off the edges
             where a thumb rests while scoring. -->
        <div class="centre">
          <div class="centre__period" :aria-label="periodTitle">
            <q-btn
              v-if="period > 1"
              dense
              flat
              round
              size="xs"
              color="white"
              icon="chevron_left"
              aria-label="Back a period"
              @click="backPeriod"
            />
            <span>{{ periodShort }}</span>
          </div>
          <!-- The button is abbreviated to fit the column; the full wording is
               kept for anything reading it aloud. -->
          <button
            type="button"
            class="centre__btn"
            :aria-label="endPeriodLabel"
            @click="advancePeriod"
          >{{ endPeriodShort }}</button>
          <button
            type="button"
            class="centre__btn centre__btn--end"
            @click="endMatch"
          >End match</button>
          <!-- Set apart from the two buttons above it, and away from the
               scoring grid a thumb rests on, because it ends the bout in one
               step and cannot be inferred from the score. -->
          <button
            type="button"
            class="centre__btn centre__btn--fall"
            @click="fallOpen = true"
          >Fall</button>
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
      </header>

      <!-- Infractions sit above the scoring buttons and are deliberately
           small. They are the rarest calls by a distance and the most costly
           to hit by accident, so they get the least reachable row and the
           smallest targets, while the six calls that make up almost every
           bout get the bottom of the screen and the big ones.

           Outlined rather than filled because they are the one set that does
           NOT score for the colour they sit under: tap on the offender, as the
           official calls it, and the point goes the other way. -->
      <div class="call-note">Infractions — tap on the offender</div>
      <div class="inf-grid">
        <div class="inf-col">
          <button
            v-for="button in ourInfractions"
            :key="`us-${button.key}`"
            type="button"
            class="inf-btn"
            :class="[`inf-btn--${ourBand}`, { 'inf-btn--final': button.final }]"
            :disabled="button.disabled"
            :title="button.aria"
            :aria-label="button.aria"
            @click="button.run()"
          >
            <q-icon :name="button.icon" size="17px" />
            <span class="inf-btn__cap">{{ button.caption }}</span>
          </button>
        </div>
        <div class="inf-col">
          <button
            v-for="button in theirInfractions"
            :key="`them-${button.key}`"
            type="button"
            class="inf-btn"
            :class="[`inf-btn--${theirBand}`, { 'inf-btn--final': button.final }]"
            :disabled="button.disabled"
            :title="button.aria"
            :aria-label="button.aria"
            @click="button.run()"
          >
            <q-icon :name="button.icon" size="17px" />
            <span class="inf-btn__cap">{{ button.caption }}</span>
          </button>
        </div>
      </div>

      <!-- The tape: what has just gone in, so a mis-tap is visible immediately
           rather than at the end of the bout. Undo sits at its right-hand end,
           beside the call it will remove. -->
      <div class="tape-row">
        <ul class="tape">
          <li v-if="recentCalls.length === 0" class="tape__empty">No calls yet</li>
          <li
            v-for="call in recentCalls"
            :key="call.key"
            class="tape__chip"
            :class="[`tape__chip--${call.band}`, { 'tape__chip--outline': call.infraction }]"
            :title="call.name"
          >{{ call.label }}</li>
        </ul>
        <q-btn
          dense
          flat
          round
          color="white"
          icon="undo"
          aria-label="Undo the last call"
          :disable="events.length === 0"
          @click="undo"
        />
        <q-btn
          dense
          flat
          round
          color="white"
          icon="table_rows"
          aria-label="Open the box score"
          @click="boxScoreOpen = true"
        />
      </div>

      <!-- Columns are the two bands, not "us" and "them". Ours stays on the
           left so the layout never moves, but it wears whichever colour was
           declared. Filled buttons add points to that colour. -->
      <div class="call-grid">
        <div class="call-col">
          <button
            v-for="call in CALLS"
            :key="`us-${call}`"
            type="button"
            class="call-btn"
            :class="`call-btn--${ourBand}`"
            :title="eventName(call)"
            :aria-label="`${eventName(call)}, ${ourBand}`"
            @click="record(call, 'wrestler')"
          >{{ eventLabel(call) }}</button>
        </div>
        <div class="call-col">
          <button
            v-for="call in CALLS"
            :key="`them-${call}`"
            type="button"
            class="call-btn"
            :class="`call-btn--${theirBand}`"
            :title="eventName(call)"
            :aria-label="`${eventName(call)}, ${theirBand}`"
            @click="record(call, 'opponent')"
          >{{ eventLabel(call) }}</button>
        </div>
      </div>

      <!-- Below the scoring grid, where nothing is tapped in a hurry. Leaving
           mid-bout is safe — the draft is written after every call, so coming
           back resumes exactly here — and that is said out loud, because
           otherwise nobody would risk finding out. -->
      <div class="score-leave-row">
        <q-btn
          flat
          dense
          no-caps
          size="sm"
          color="white"
          icon="arrow_back"
          label="Leave"
          to="/admin"
        />
        <span class="score-leave-row__note">The bout is kept if you do</span>
      </div>

      <BoxScoreDialog
        v-model="boxScoreOpen"
        :events="events"
        :our-name="wrestlerName || 'Ours'"
        :their-name="opponentName || 'Opponent'"
        :our-band="ourBand ?? 'red'"
        @update:events="events = $event"
      />

      <PeriodChoiceDialog
        v-model="choiceOpen"
        :period="choiceFor"
        :events="events"
        :our-name="wrestlerName || 'Ours'"
        :their-name="opponentName || 'Opponent'"
        :our-band="ourBand ?? 'red'"
        @done="applyChoice"
      />

      <FallDialog
        v-model="fallOpen"
        :period="period"
        :our-name="wrestlerName || 'Ours'"
        :their-name="opponentName || 'Opponent'"
        :our-band="ourBand ?? 'red'"
        @record="recordFall"
      />
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

      <!-- Every ending that stopped the clock wants this, not just a fall.
           Required, because right now is the only moment anyone still knows. -->
      <div v-if="timingRequired" class="row q-col-gutter-sm q-mt-sm">
        <div class="col-6">
          <q-input
            v-model.number="endPeriod"
            type="number"
            min="1"
            label="Period it ended in *"
            outlined
            dark
          />
        </div>
        <div class="col-6">
          <q-input
            v-model="endTime"
            label="Time into the period *"
            mask="#:##"
            placeholder="0:09"
            outlined
            dark
            :error="endTime.length > 0 && !endTimeValid"
            error-message="Enter it as M:SS"
          />
        </div>
        <div class="col-12 score-hint">
          A {{ winTypeLabel(winType).toLowerCase() }} stopped the bout, so the
          sheet records how far into the period it happened — not what was left
          on the clock, which would need the period length to make sense of.
          0:00 is a real answer for a technical fall.
        </div>
      </div>

      <div class="row q-gutter-sm q-mt-lg">
        <q-btn flat no-caps color="white" label="Back" @click="stage = 'scoring'" />
        <q-space />
        <q-btn flat no-caps color="negative" label="Discard" @click="discard" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Save bout"
          :disable="!canSave"
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

/* Three columns: a wrestler, the controls, the other wrestler. The centre is
   sized to its content so the two scores always get equal space. */
.score-head {
  display: grid;
  grid-template-columns: 1fr minmax(88px, auto) 1fr;
  gap: 8px;
  text-align: center;
  margin-bottom: 14px;
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

/* Match controls ---------------------------------------------------------
 *
 * Between the scores rather than along the bottom: this column belongs to
 * neither wrestler, and the bottom of the screen is now entirely the six
 * scoring buttons, which is where a thumb should be able to land blind.
 */
.centre {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 6px;
  padding-top: 4px;
}

.centre__period {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.86rem;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.6);
}

.centre__btn {
  appearance: none;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: transparent;
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
}

.centre__btn:active {
  background: rgba(255, 255, 255, 0.12);
}

.centre__btn--end {
  border-color: var(--gold-500, #d4a017);
  color: var(--gold-500, #d4a017);
}

/* Gapped away from the others and in the mat's own red: this one ends the
   bout outright, and it sits in the middle column precisely because that is
   the part of the screen nothing else is being tapped on. */
.centre__btn--fall {
  margin-top: 6px;
  border-color: var(--band-red-ink);
  color: var(--band-red-ink);
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
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

.call-note {
  margin-bottom: 4px;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
}

/* Infractions ------------------------------------------------------------
 *
 * Outlined, never filled: these are the one set of buttons that does NOT
 * score for the colour they sit under, and the difference in treatment is
 * what stops a scorer reading them as "green scored" at a glance.
 *
 * Icons carry a caption rather than standing alone. Bare glyphs would be
 * smaller still, but a scorer who has to pause and decode one has lost the
 * time the small size was meant to save, and these calls are the expensive
 * ones to get wrong.
 */
.inf-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.inf-col {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.inf-btn {
  appearance: none;
  font: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  padding: 5px 1px;
  border-radius: var(--radius-sm);
  border: 1.5px solid transparent;
  background: transparent;
  cursor: pointer;
}

.inf-btn:active {
  filter: brightness(1.3);
}

.inf-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.inf-btn--red {
  border-color: var(--band-red-ink);
  color: var(--band-red-ink);
}

.inf-btn--green {
  border-color: var(--band-green-ink);
  color: var(--band-green-ink);
}

/* What this call will cost, read straight off the chart. */
.inf-btn__cap {
  font-size: 0.6rem;
  letter-spacing: 0.02em;
  line-height: 1.1;
  white-space: nowrap;
}

/* One more ends it. Worth shouting about before it is tapped, not after. */
.inf-btn--final {
  border-color: var(--band-red-ink);
  color: var(--band-red-ink);
  background: rgba(198, 36, 49, 0.22);
}

/* The tape ---------------------------------------------------------------
 *
 * Oldest to newest, left to right, so the newest sits next to Undo — the
 * button that will remove it.
 */
.tape-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
  min-height: 34px;
}

.tape {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  list-style: none;
  margin: 0;
  padding: 0;
}

.tape__chip {
  flex: none;
  min-width: 30px;
  text-align: center;
  padding: 3px 5px;
  border-radius: var(--radius-sm);
  border: 1.5px solid transparent;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.78rem;
  color: #fff;
}

.tape__chip--red {
  background: var(--band-red);
}

.tape__chip--green {
  background: var(--band-green);
}

/* Mirrors the buttons: filled scored for that colour, outlined was called on
   it. Same rule in both places means the tape needs no legend. */
.tape__chip--outline {
  background: transparent;
}

.tape__chip--outline.tape__chip--red {
  border-color: var(--band-red-ink);
  color: var(--band-red-ink);
}

.tape__chip--outline.tape__chip--green {
  border-color: var(--band-green-ink);
  color: var(--band-green-ink);
}

.tape__empty {
  font-size: 0.76rem;
  color: rgba(255, 255, 255, 0.35);
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

/* Set off from the title so it reads as a way out rather than a heading. */
.score-leave {
  margin: 0 0 6px -6px;
  opacity: 0.75;
}

.score-leave-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  opacity: 0.6;
}

.score-leave-row__note {
  font-size: 0.74rem;
  color: rgba(255, 255, 255, 0.55);
}

.score-hint {
  font-size: 0.78rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.5);
}
</style>
