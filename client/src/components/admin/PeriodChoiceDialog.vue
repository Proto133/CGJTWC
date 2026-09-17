<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { chooserFor } from 'src/utils/matchScoring'
import { eventLabel, eventName, periodName } from 'src/utils/matchLabels'
import type { MatchEvent, MatchEventType } from 'src/types'

/**
 * Who had choice at the start of a period, and what they took.
 *
 * Asked between periods because that is when it happens and when the scorer
 * knows. Reconstructing it afterwards from a finished bout is guesswork.
 *
 * Only the second period asks who. By the third it follows from the rules, so
 * asking again would be asking the scorer to repeat something the app already
 * knows — and to get it wrong under pressure.
 */

type Side = 'wrestler' | 'opponent'

const props = defineProps<{
  modelValue: boolean
  /** The period about to start. */
  period: number
  events: MatchEvent[]
  ourName: string
  theirName: string
  ourBand: 'red' | 'green'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void
  /** Chosen marks, or an empty list when the scorer skipped. */
  (e: 'done', events: MatchEvent[]): void
}>()

const theirBand = computed<'red' | 'green'>(() => (props.ourBand === 'red' ? 'green' : 'red'))

function bandOf(side: Side) {
  return side === 'wrestler' ? props.ourBand : theirBand.value
}

function nameOf(side: Side) {
  return side === 'wrestler' ? props.ourName : props.theirName
}

/** Known for the third period, asked for the second. */
const inferred = computed(() => chooserFor(props.events, props.period))

/** Who we are currently asking about. */
const chooser = ref<Side | null>(null)

/**
 * Set when the wrestler with choice deferred, at which point the question
 * becomes what the other one took instead.
 */
const deferredBy = ref<Side | null>(null)

const pending = ref<MatchEvent[]>([])

watch(
  () => [props.modelValue, props.period] as const,
  ([open]) => {
    if (!open) return
    chooser.value = inferred.value
    deferredBy.value = null
    pending.value = []
  },
  { immediate: true },
)

/** Deferring is only on the table for whoever has first choice. */
const options = computed<MatchEventType[]>(() => {
  const positions: MatchEventType[] = ['chooseUp', 'chooseDown', 'chooseNeutral']
  return deferredBy.value || props.period > 2 ? positions : [...positions, 'defer']
})

function finish(events: MatchEvent[]) {
  emit('done', events)
  emit('update:modelValue', false)
}

function pick(type: MatchEventType) {
  const side = chooser.value
  if (!side) return

  const mark: MatchEvent = { type, side, period: props.period }

  // Deferring is not an answer, it is a handover: the other wrestler now makes
  // the actual choice for this period, and both marks belong on the sheet.
  if (type === 'defer') {
    pending.value = [mark]
    deferredBy.value = side
    chooser.value = side === 'wrestler' ? 'opponent' : 'wrestler'
    return
  }

  finish([...pending.value, mark])
}

function skip() {
  finish([])
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="choice-card">
      <q-card-section>
        <div class="choice__period">{{ periodName(period) }}</div>
        <div class="choice__ask">
          <template v-if="!chooser">Who has choice?</template>
          <template v-else-if="deferredBy">
            {{ nameOf(deferredBy) }} deferred — what did {{ nameOf(chooser) }} take?
          </template>
          <template v-else>What did {{ nameOf(chooser) }} take?</template>
        </div>
      </q-card-section>

      <q-card-section>
        <!-- Only the second period gets this far: the third is inferred. -->
        <div v-if="!chooser" class="choice__row">
          <button
            v-for="side in (['wrestler', 'opponent'] as Side[])"
            :key="side"
            type="button"
            class="choice-btn choice-btn--who"
            :class="`choice-btn--${bandOf(side)}`"
            @click="chooser = side"
          >
            <span class="choice-btn__band">{{ bandOf(side) }}</span>
            <span class="choice-btn__name">{{ nameOf(side) }}</span>
          </button>
        </div>

        <div v-else class="choice__row">
          <button
            v-for="option in options"
            :key="option"
            type="button"
            class="choice-btn"
            :class="`choice-btn--${bandOf(chooser)}`"
            :aria-label="eventName(option)"
            @click="pick(option)"
          >
            <span class="choice-btn__mark">{{ eventLabel(option) }}</span>
            <span class="choice-btn__name">{{ eventName(option).replace('Selects ', '') }}</span>
          </button>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <!-- The bout must never be held up by a question about paperwork. -->
        <q-btn flat no-caps color="grey-7" label="Skip" @click="skip" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.choice-card {
  width: 420px;
  max-width: 94vw;
  background: var(--navy-900);
  color: #fff;

  --band-red: #c62431;
  --band-red-ink: #ff8a94;
  --band-green: #14803c;
  --band-green-ink: #5fd98a;
}

.choice__period {
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}

.choice__ask {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.15rem;
  margin-top: 2px;
}

.choice__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: 8px;
}

.choice-btn {
  appearance: none;
  font: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 14px 6px;
  border-radius: var(--radius-md);
  border: 2px solid rgba(255, 255, 255, 0.25);
  background: transparent;
  color: #fff;
  cursor: pointer;
}

.choice-btn:active {
  filter: brightness(1.3);
}

.choice-btn--red {
  border-color: var(--band-red-ink);
}

.choice-btn--green {
  border-color: var(--band-green-ink);
}

/* Filled when picking a wrestler, so the two bands read as the mat does. */
.choice-btn--who.choice-btn--red {
  background: var(--band-red);
  border-color: var(--band-red);
}

.choice-btn--who.choice-btn--green {
  background: var(--band-green);
  border-color: var(--band-green);
}

.choice-btn__band {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.choice-btn__mark {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.5rem;
  line-height: 1;
}

.choice-btn__name {
  font-size: 0.72rem;
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
</style>
