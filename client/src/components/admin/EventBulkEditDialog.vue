<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useEventsStore } from 'stores/events'
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
  time: false,
  location: false,
  type: false,
  group: false,
  opponent: false,
  description: false,
})

const values = ref<{
  time: string
  location: string
  type: EventType
  group: string
  opponent: string
  description: string
}>({
  time: '',
  location: '',
  type: 'practice',
  group: '',
  opponent: '',
  description: '',
})

function reset() {
  enabled.value = {
    time: false,
    location: false,
    type: false,
    group: false,
    opponent: false,
    description: false,
  }
  values.value = {
    time: '',
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
  if (enabled.value.time) out.time = values.value.time.trim()
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

const canApply = computed(() =>
  props.ids.length > 0 && changedFields.value.length > 0 && !locationBlank.value)

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
          <q-checkbox v-model="enabled.time" dense label="Time" class="field-row__tick" />
          <q-input
            v-model="values.time"
            outlined
            dense
            :disable="!enabled.time"
            placeholder="6:00 PM, 4:15-5:15, All Day"
            class="field-row__input"
          />
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

.bulk-note {
  font-size: 0.82rem;
  color: var(--grey-500);
  line-height: 1.5;
  padding-top: 4px;
}
</style>
