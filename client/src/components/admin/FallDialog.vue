<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { periodName } from 'src/utils/matchLabels'

/**
 * Recording a fall.
 *
 * Two steps on purpose. A fall is the only ending that cannot be worked out
 * from the score, so it needs a button of its own — and a single-tap button
 * that ends a live bout is a button that will end one by accident. Asking who
 * pinned, then the clock, makes it deliberate without making it slow.
 */

type Side = 'wrestler' | 'opponent'

const props = defineProps<{
  modelValue: boolean
  period: number
  ourName: string
  theirName: string
  ourBand: 'red' | 'green'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void
  (e: 'record', side: Side, clock: string): void
}>()

const theirBand = computed<'red' | 'green'>(() => (props.ourBand === 'red' ? 'green' : 'red'))

function bandOf(side: Side) {
  return side === 'wrestler' ? props.ourBand : theirBand.value
}

function nameOf(side: Side) {
  return side === 'wrestler' ? props.ourName : props.theirName
}

const pinner = ref<Side | null>(null)
const clock = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    pinner.value = null
    clock.value = ''
  },
)

/** The scoresheet format, and what the rules validate. */
const valid = computed(() => /^[0-9]:[0-5][0-9]$/.test(clock.value))

function confirm() {
  if (!pinner.value || !valid.value) return
  emit('record', pinner.value, clock.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="fall-card">
      <q-card-section>
        <div class="fall__title">Fall</div>
        <div class="fall__sub">{{ periodName(period) }}</div>
      </q-card-section>

      <q-card-section>
        <div class="fall__ask">Who pinned?</div>
        <div class="fall__row">
          <button
            v-for="side in (['wrestler', 'opponent'] as Side[])"
            :key="side"
            type="button"
            class="fall-btn"
            :class="[`fall-btn--${bandOf(side)}`, { 'fall-btn--on': pinner === side }]"
            @click="pinner = side"
          >
            <span class="fall-btn__band">{{ bandOf(side) }}</span>
            <span class="fall-btn__name">{{ nameOf(side) }}</span>
          </button>
        </div>

        <!-- Time left, not time elapsed: it is what the clock on the wall says
             at the moment the referee's hand comes down, so it is the only
             number the scorer can actually read off. -->
        <q-input
          v-model="clock"
          class="q-mt-md"
          label="Time left in the period *"
          mask="#:##"
          placeholder="1:38"
          outlined
          dark
          :error="clock.length > 0 && !valid"
          error-message="Enter it as M:SS"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-close-popup flat no-caps color="white" label="Cancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="End by fall"
          :disable="!pinner || !valid"
          @click="confirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.fall-card {
  width: 420px;
  max-width: 94vw;
  background: var(--navy-900);
  color: #fff;

  --band-red: #c62431;
  --band-red-ink: #ff8a94;
  --band-green: #14803c;
  --band-green-ink: #5fd98a;
}

.fall__title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.3rem;
  text-transform: uppercase;
}

.fall__sub {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}

.fall__ask {
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 6px;
}

.fall__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.fall-btn {
  appearance: none;
  font: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 6px;
  border-radius: var(--radius-md);
  border: 2px solid rgba(255, 255, 255, 0.25);
  background: transparent;
  color: #fff;
  cursor: pointer;
}

.fall-btn--red {
  border-color: var(--band-red-ink);
}

.fall-btn--green {
  border-color: var(--band-green-ink);
}

/* Filled once chosen, so the selection is unmistakable before confirming. */
.fall-btn--on.fall-btn--red {
  background: var(--band-red);
  border-color: var(--band-red);
}

.fall-btn--on.fall-btn--green {
  background: var(--band-green);
  border-color: var(--band-green);
}

.fall-btn__band {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.fall-btn__name {
  font-size: 0.74rem;
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
</style>
