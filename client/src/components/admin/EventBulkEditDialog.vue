<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useEventsStore } from 'stores/events'
import TimeField from 'components/admin/TimeField.vue'
import { EVENT_TYPES } from 'src/utils/eventsCsv'
import { ALL_GROUPS, cleanGroup, isAllGroups } from 'src/utils/eventGroups'
import type { EventFormPayload, EventType } from 'src/types'

const props = defineProps<{
  modelValue: boolean
  ids: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void
  (e: 'done'): void
}>()

const store = useEventsStore()

/**
 * Each field is opt-in.
 *
 * Without the toggles an empty input would be indistinguishable from "leave it
 * alone", and applying the form wholesale would wipe the time, opponent and
 * description on every selected event. Only enabled fields are sent.
 */
const enabled = ref({
  times: false,
  location: false,
  type: false,
  group: false,
  opponent: false,
  description: false,
})

const values = ref<{
  startTime: string
  endTime: string
  allDay: boolean
  location: string
  type: EventType
  group: string
  opponent: string
  description: string
}>({
  startTime: '',
  endTime: '',
  allDay: false,
  location: '',
  type: 'practice',
  group: '',
  opponent: '',
  description: '',
})

function reset() {
  enabled.value = {
    times: false,
    location: false,
    type: false,
    group: false,
    opponent: false,
    description: false,
  }
  values.value = {
    startTime: '',
    endTime: '',
    allDay: false,
    location: '',
    type: 'practice',
    group: '',
    opponent: '',
    description: '',
  }
}

const groupSuggestions = computed(() => [ALL_GROUPS, ...store.squads])

// q-select's clearable writes null, which the string-typed state cannot hold.
const groupModel = computed({
  get: () => values.value.group,
  set: (value: string | null) => {
    values.value.group = value ?? ''
  },
})

watch(() => props.modelValue, (open) => {
  if (!open) reset()
})

const changes = computed<Partial<EventFormPayload>>(() => {
  const out: Partial<EventFormPayload> = {}
  if (enabled.value.times) {
    if (values.value.allDay) {
      // All day and a clock time are mutually exclusive, so setting one clears
      // the other rather than leaving a contradictory pair on the document.
      out.allDay = true
      out.startTime = ''
      out.endTime = ''
    } else {
      out.allDay = false
      out.startTime = values.value.startTime
      out.endTime = values.value.endTime
    }
  }
  if (enabled.value.location) out.location = values.value.location.trim()
  if (enabled.value.type) out.type = values.value.type
  if (enabled.value.group) {
    const group = values.value.group
    out.group = isAllGroups(group) ? ALL_GROUPS : cleanGroup(group)
  }
  if (enabled.value.opponent) out.opponent = values.value.opponent.trim()
  if (enabled.value.description) out.description = values.value.description.trim()
  return out
})

const changedFields = computed(() => Object.keys(changes.value))

/**
 * Location is required on an event, so blanking it would leave the schedule
 * showing an event with nowhere to be. Everything else may legitimately be
 * cleared by enabling it and leaving the box empty.
 */
const locationBlank = computed(() =>
  enabled.value.location && values.value.location.trim() === '')

/**
 * An end with no start would leave the events showing a finish time and no
 * beginning, so it is refused rather than silently dropped.
 */
const endWithoutStart = computed(() =>
  enabled.value.times
  && !values.value.allDay
  && values.value.endTime !== ''
  && values.value.startTime === '')

const endBeforeStart = computed(() =>
  enabled.value.times
  && !values.value.allDay
  && values.value.startTime !== ''
  && values.value.endTime !== ''
  // Zero-padded 24-hour values compare correctly as strings.
  && values.value.endTime <= values.value.startTime)

const canApply = computed(() =>
  props.ids.length > 0
  && changedFields.value.length > 0
  && !locationBlank.value
  && !endWithoutStart.value
  && !endBeforeStart.value)

async function apply() {
  const ok = await store.updateMany(props.ids, changes.value)
  if (ok) {
    emit('done')
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="bulk-card">
      <q-card-section>
        <div class="dialog-title">
          Edit {{ ids.length }} event{{ ids.length === 1 ? '' : 's' }}
        </div>
        <div class="dialog-sub">
          Tick only what you want to change. Anything left unticked is untouched.
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-sm">
        <div class="field-row">
          <q-checkbox v-model="enabled.times" dense label="Time" class="field-row__tick" />
          <div class="field-row__input">
            <q-checkbox
              v-model="values.allDay"
              dense
              label="All day"
              :disable="!enabled.times"
            />
            <div class="time-pair">
              <TimeField
                v-model="values.startTime"
                label="Start"
                :disable="!enabled.times || values.allDay"
              />
              <TimeField
                v-model="values.endTime"
                label="End"
                :disable="!enabled.times || values.allDay"
              />
            </div>
            <div v-if="endWithoutStart" class="field-error">
              Add a start time, or clear the end time.
            </div>
            <div v-else-if="endBeforeStart" class="field-error">
              The end time must be after the start time.
            </div>
            <div v-else-if="enabled.times && !values.allDay" class="field-hint">
              Leave both empty to clear the times.
            </div>
          </div>
        </div>

        <div class="field-row">
          <q-checkbox
            v-model="enabled.location"
            dense
            label="Location"
            class="field-row__tick"
          />
          <q-input
            v-model="values.location"
            outlined
            dense
            :disable="!enabled.location"
            :error="locationBlank"
            error-message="Location cannot be blank"
            class="field-row__input"
          />
        </div>

        <div class="field-row">
          <q-checkbox v-model="enabled.type" dense label="Type" class="field-row__tick" />
          <q-select
            v-model="values.type"
            :options="EVENT_TYPES"
            outlined
            dense
            :disable="!enabled.type"
            class="field-row__input"
          />
        </div>

        <div class="field-row">
          <q-checkbox
            v-model="enabled.group"
            dense
            label="Squad / Group"
            class="field-row__tick"
          />
          <q-select
            v-model="groupModel"
            :options="groupSuggestions"
            outlined
            dense
            clearable
            use-input
            fill-input
            hide-selected
            new-value-mode="add-unique"
            input-debounce="0"
            :disable="!enabled.group"
            hint="ALL for both squads. Leave empty to clear it"
            class="field-row__input"
          />
        </div>

        <div class="field-row">
          <q-checkbox
            v-model="enabled.opponent"
            dense
            label="Opponent"
            class="field-row__tick"
          />
          <q-input
            v-model="values.opponent"
            outlined
            dense
            :disable="!enabled.opponent"
            hint="Leave empty to clear it"
            class="field-row__input"
          />
        </div>

        <div class="field-row">
          <q-checkbox
            v-model="enabled.description"
            dense
            label="Description"
            class="field-row__tick"
          />
          <q-input
            v-model="values.description"
            outlined
            dense
            autogrow
            :disable="!enabled.description"
            hint="Leave empty to clear it"
            class="field-row__input"
          />
        </div>

        <!-- Date is deliberately absent: setting one identical date across many
             events is almost always a mistake. Shifting a whole block by a
             number of days is the operation that would actually be wanted, and
             it is a different feature. -->
        <div class="bulk-note">
          Dates are not editable in bulk, since every event needs its own. Change
          those individually, or re-import a corrected spreadsheet.
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancel" @click="emit('update:modelValue', false)" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          :disable="!canApply"
          :loading="store.bulkWorking"
          :label="changedFields.length
            ? `Apply to ${ids.length} event${ids.length === 1 ? '' : 's'}`
            : 'Nothing selected to change'"
          @click="apply"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.bulk-card {
  width: 560px;
  max-width: 94vw;
}

.dialog-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.15rem;
  text-transform: uppercase;
  color: var(--navy-800);
}

.dialog-sub {
  font-size: 0.86rem;
  color: var(--grey-600);
  margin-top: 2px;
}

.field-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.field-row__tick {
  min-width: 132px;
  padding-top: 6px;
}

.field-row__input {
  flex: 1;
  min-width: 0;
}

.time-pair {
  display: flex;
  gap: 8px;
}

.time-pair > * {
  flex: 1;
  min-width: 0;
}

.field-error {
  font-size: 0.78rem;
  color: var(--negative, #c10015);
  margin-top: 4px;
}

.field-hint {
  font-size: 0.78rem;
  color: var(--grey-500);
  margin-top: 4px;
}

.bulk-note {
  font-size: 0.82rem;
  color: var(--grey-500);
  line-height: 1.5;
  padding-top: 4px;
}
</style>
