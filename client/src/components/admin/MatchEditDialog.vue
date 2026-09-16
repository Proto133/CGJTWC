<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dialog, date as qdate } from 'quasar'
import { useMatchesStore } from 'stores/matches'
import { emptyCounts, reconcile, scoreFromCounts, scoreFromEvents } from 'src/utils/matchScoring'
import { WIN_TYPE_OPTIONS } from 'src/utils/wrestlerStats'
import type { Match, MatchCounts, MatchResult, MatchWinType } from 'src/types'

/**
 * Correcting a bout after the fact.
 *
 * Results get entered in a gym on a phone, so they get entered wrong. The two
 * mistakes worth being able to fix are the score and how the bout ended, since
 * those are what a record and the team points are built from.
 *
 * The scoring detail is editable only for bouts that were entered by hand. A
 * bout scored live carries the log of calls as they happened, and that log is
 * the record — overwriting it with totals typed afterwards would throw away the
 * more reliable of the two and leave nothing to say it had happened.
 */

const props = defineProps<{
  modelValue: boolean
  match: Match | null
}>()

const emit = defineEmits<{ (e: 'update:modelValue', open: boolean): void }>()

const matchesStore = useMatchesStore()

const liveScored = computed(() => Boolean(props.match?.events?.length))

interface FormState {
  result: MatchResult
  winType: MatchWinType
  officialFor: number | null
  officialAgainst: number | null
  opponentName: string
  opponentTeam: string
  weightClass: string
  round: string
  counts: MatchCounts
}

function formFrom(match: Match | null): FormState {
  return {
    result: match?.result ?? 'win',
    winType: match?.winType ?? 'decision',
    officialFor: match?.officialFor ?? null,
    officialAgainst: match?.officialAgainst ?? null,
    opponentName: match?.opponentName ?? '',
    opponentTeam: match?.opponentTeam ?? '',
    weightClass: match?.weightClass ?? '',
    round: match?.round ?? '',
    counts: { ...emptyCounts(), ...(match?.counts ?? {}) },
  }
}

const form = ref<FormState>(formFrom(null))

// Refilled whenever a different bout is opened, so the previous one's values
// cannot leak into it.
watch(
  () => [props.match, props.modelValue] as const,
  () => {
    if (props.modelValue) form.value = formFrom(props.match)
  },
  { immediate: true },
)

const COUNT_FIELDS: { key: keyof MatchCounts; label: string }[] = [
  { key: 'takedowns', label: 'Takedowns' },
  { key: 'escapes', label: 'Escapes' },
  { key: 'reversals', label: 'Reversals' },
  { key: 'nearFall2', label: 'Near fall 2' },
  { key: 'nearFall3', label: 'Near fall 3' },
  { key: 'nearFall4', label: 'Near fall 4' },
  { key: 'penalties', label: 'Penalties' },
  { key: 'stalls', label: 'Stalls' },
]

const anyCounts = computed(() => COUNT_FIELDS.some((f) => (form.value.counts[f.key] ?? 0) > 0))

/** What the typed detail adds up to, shown as it is typed. */
const detailPoints = computed(() => {
  if (liveScored.value && props.match?.events) return scoreFromEvents(props.match.events).for
  return scoreFromCounts(form.value.counts)
})

/** The state this bout would be in if saved as it currently stands. */
const wouldBe = computed(() => reconcile({
  winType: form.value.winType,
  ...(liveScored.value ? { events: props.match?.events ?? [] } : {}),
  ...(!liveScored.value && (anyCounts.value || props.match?.counts)
    ? { counts: form.value.counts }
    : {}),
  ...(form.value.officialFor !== null ? { officialFor: form.value.officialFor } : {}),
  ...(form.value.officialAgainst !== null ? { officialAgainst: form.value.officialAgainst } : {}),
}))

const STATE_NOTES: Record<string, string> = {
  complete: 'Detail agrees with the official score. This bout counts towards the totals.',
  notApplicable: 'Nothing to reconcile. This bout counts towards the record only.',
  resultOnly: 'No scoring detail. The result counts; takedowns and points do not.',
  mismatch: 'The detail does not add up to the official score, so it is left out of the totals.',
  unverifiable: 'No official score, so the detail cannot be checked.',
}

const scoresInvalid = computed(() =>
  [form.value.officialFor, form.value.officialAgainst].some(
    (v) => v !== null && (!Number.isInteger(v) || v < 0),
  ))

const when = computed(() =>
  props.match ? qdate.formatDate(props.match.date.toDate(), 'D MMM YYYY') : '')

function close() {
  emit('update:modelValue', false)
}

async function save() {
  if (!props.match || scoresInvalid.value) return

  const changes: Partial<Omit<Match, 'id'>> = {
    result: form.value.result,
    winType: form.value.winType,
    // Written even when blank, so clearing a mistyped opponent is possible.
    opponentName: form.value.opponentName.trim(),
    opponentTeam: form.value.opponentTeam.trim(),
    weightClass: form.value.weightClass.trim(),
    round: form.value.round.trim(),
    ...(form.value.officialFor !== null ? { officialFor: form.value.officialFor } : {}),
    ...(form.value.officialAgainst !== null ? { officialAgainst: form.value.officialAgainst } : {}),
  }

  // Only written when there is something to write, or when the bout already
  // carried counts. An untouched all-zero grid saved onto a bout that had no
  // detail would turn "nobody entered this" into "this wrestler scored nothing",
  // which reads the same on screen and is not the same claim.
  if (!liveScored.value && (anyCounts.value || props.match.counts)) {
    changes.counts = { ...form.value.counts }
  }

  const ok = await matchesStore.update(props.match.id, changes)
  if (ok) close()
}

function confirmDelete() {
  const id = props.match?.id
  if (!id) return

  Dialog.create({
    title: 'Delete this bout?',
    message: 'It will be removed from the wrestler\u2019s record and from the event results.',
    cancel: true,
    ok: { label: 'Delete', color: 'negative', flat: true },
  }).onOk(() => {
    void matchesStore.remove(id).then((ok) => {
      if (ok) close()
    })
  })
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card v-if="match" class="edit-card">
      <q-card-section>
        <div class="dialog-title">Edit bout</div>
        <div class="dialog-sub">
          {{ when }}
          <template v-if="match.eventName"> · {{ match.eventName }}</template>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-md">
        <div class="row q-col-gutter-sm">
          <div class="col-6">
            <q-select
              v-model="form.result"
              :options="[{ label: 'Win', value: 'win' }, { label: 'Loss', value: 'loss' }]"
              label="Result"
              outlined
              dense
              emit-value
              map-options
            />
          </div>
          <div class="col-6">
            <q-select
              v-model="form.winType"
              :options="WIN_TYPE_OPTIONS"
              label="How it ended"
              outlined
              dense
              emit-value
              map-options
            />
          </div>
        </div>

        <div class="row q-col-gutter-sm">
          <div class="col-6">
            <q-input
              v-model.number="form.officialFor"
              type="number"
              min="0"
              label="Official — ours"
              outlined
              dense
            />
          </div>
          <div class="col-6">
            <q-input
              v-model.number="form.officialAgainst"
              type="number"
              min="0"
              label="Official — theirs"
              outlined
              dense
            />
          </div>
        </div>

        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.opponentName" label="Opponent" outlined dense />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.opponentTeam" label="Their club" outlined dense />
          </div>
          <div class="col-6">
            <q-input v-model="form.weightClass" label="Weight" outlined dense />
          </div>
          <div class="col-6">
            <q-input v-model="form.round" label="Round" outlined dense />
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="block-label">Scoring detail</div>

        <!-- A live-scored bout shows its log rather than a form. The calls were
             recorded as they were made; totals typed a week later are not an
             improvement on that. -->
        <div v-if="liveScored" class="detail-locked">
          Scored live — {{ match.events?.length }} calls recorded, adding up to
          {{ detailPoints }} points. The log is the record and is not editable here.
        </div>

        <template v-else>
          <p class="detail-help">
            Counts for our wrestler. Penalties and stalls are the ones called
            <em>on</em> them, which is why they do not add to the total below.
          </p>
          <div class="count-grid">
            <q-input
              v-for="field in COUNT_FIELDS"
              :key="field.key"
              v-model.number="form.counts[field.key]"
              type="number"
              min="0"
              :label="field.label"
              outlined
              dense
            />
          </div>
        </template>

        <div class="reconcile" :class="`reconcile--${wouldBe}`">
          <q-icon
            :name="wouldBe === 'complete' || wouldBe === 'notApplicable' ? 'check_circle' : 'info'"
            size="15px"
            class="q-mr-xs"
          />
          <span v-if="!liveScored && wouldBe === 'mismatch'">
            Detail adds up to {{ detailPoints }}, official says
            {{ form.officialFor ?? 0 }}. {{ STATE_NOTES[wouldBe] }}
          </span>
          <span v-else>{{ STATE_NOTES[wouldBe] }}</span>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat no-caps color="negative" label="Delete" @click="confirmDelete" />
        <q-space />
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Save"
          :disable="scoresInvalid"
          :loading="matchesStore.saving"
          @click="save"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.edit-card {
  width: 540px;
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

.block-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--grey-500);
  margin-bottom: 8px;
}

.detail-help {
  margin: 0 0 10px;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--grey-600);
}

.detail-locked {
  font-size: 0.84rem;
  line-height: 1.5;
  color: var(--grey-600);
  background: var(--grey-050, #fafafa);
  border: 1px solid var(--grey-200);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}

.count-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
}

.reconcile {
  display: flex;
  align-items: flex-start;
  margin-top: 12px;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--grey-600);
}

.reconcile--complete,
.reconcile--notApplicable {
  color: var(--positive, #16794a);
}

.reconcile--mismatch {
  color: var(--negative, #c10015);
}
</style>
