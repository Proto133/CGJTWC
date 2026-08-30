<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEventsStore } from 'stores/events'
import TimeField from 'components/admin/TimeField.vue'
import { ALL_GROUPS, cleanGroup, isAllGroups } from 'src/utils/eventGroups'
import { formatTime, isStoredTime, parseTimeCell } from 'src/utils/eventTimes'
import { formatUsDate, parseUsDate } from 'src/utils/usDate'
import type { Event, EventType, EventFormPayload } from 'src/types'

// `| undefined` is required because the project enables
// `exactOptionalPropertyTypes`, and the parent binds `editingEvent || undefined`.
const props = defineProps<{
  modelValue?: Partial<Event> | undefined
  loading?: boolean | undefined
}>()

const emit = defineEmits<{
  (e: 'save', payload: EventFormPayload): void
  (e: 'cancel'): void
}>()

// Typed explicitly so `type` stays an EventType rather than widening to string,
// which would break the typed `save` payload.
interface EventFormState {
  title: string
  /** MM-DD-YYYY, matching the rest of the admin UI and the import template. */
  date: string
  /** 'HH:MM' 24-hour, which is what QTime binds to and what is stored. */
  startTime: string
  endTime: string
  allDay: boolean
  location: string
  type: EventType
  group: string
  opponent: string
  description: string
}

function blankForm(): EventFormState {
  return {
    title: '',
    date: formatUsDate(new Date()),
    startTime: '',
    endTime: '',
    allDay: false,
    location: '',
    // Practices are the overwhelming majority of a season, so defaulting to
    // anything else means changing this field on almost every event.
    type: 'practice',
    group: '',
    opponent: '',
    description: '',
  }
}

const form = ref<EventFormState>(blankForm())

const eventTypes: { label: string; value: EventType }[] = [
  { label: 'Practice', value: 'practice' },
  { label: 'Dual Match', value: 'dual' },
  { label: 'Tournament', value: 'tournament' },
  { label: 'Other', value: 'other' },
]

const store = useEventsStore()

/**
 * ALL first, then the squads already in use elsewhere in the schedule.
 *
 * Suggestions rather than a fixed list: the field is free text, so a new squad
 * can be typed once and is then offered on every later event, which is what
 * keeps spellings consistent without hardcoding the club's naming.
 */
const groupSuggestions = computed(() => [ALL_GROUPS, ...store.squads])
const groupOptions = ref<string[]>([])

function filterGroups(input: string, update: (fn: () => void) => void) {
  update(() => {
    const needle = input.toLowerCase()
    groupOptions.value = groupSuggestions.value.filter((option) =>
      option.toLowerCase().includes(needle))
  })
}

// q-select's clearable writes null, which the string-typed state cannot hold.
const groupModel = computed({
  get: () => form.value.group,
  set: (value: string | null) => {
    form.value.group = value ?? ''
  },
})

/**
 * Loads an event into the form, converting a legacy free-text time on the way.
 *
 * Events written before times were split hold something like "4:15-5:15 PM" in
 * a single field. Parsing it here means opening and saving such an event
 * quietly upgrades it, so the collection converts itself as the club works
 * rather than needing a migration script.
 */
watch(() => props.modelValue, (val) => {
  if (!val) {
    form.value = blankForm()
    return
  }

  const next = blankForm()
  next.title = val.title || ''
  next.date = val.date ? formatUsDate(val.date.toDate()) : formatUsDate(new Date())
  next.location = val.location || ''
  next.type = val.type || 'practice'
  next.group = val.group || ''
  next.opponent = val.opponent || ''
  next.description = val.description || ''

  if (val.allDay) {
    next.allDay = true
  } else if (isStoredTime(val.startTime)) {
    next.startTime = val.startTime!
    next.endTime = isStoredTime(val.endTime) ? val.endTime! : ''
  } else if (val.time) {
    const parsed = parseTimeCell(val.time)
    if (parsed.kind === 'all-day') {
      next.allDay = true
    } else if (parsed.kind === 'time') {
      next.startTime = parsed.start
      next.endTime = parsed.end ?? ''
    }
    // An ambiguous or unparseable legacy value is left for the admin to enter
    // by hand rather than guessed at.
  }

  form.value = next
}, { immediate: true })

// ----- validation -----

const dateValid = computed(() => parseUsDate(form.value.date) !== null)

const endWithoutStart = computed(() =>
  !form.value.allDay && form.value.endTime !== '' && form.value.startTime === '')

const endBeforeStart = computed(() =>
  !form.value.allDay
  && form.value.startTime !== ''
  && form.value.endTime !== ''
  // Zero-padded 24-hour values compare correctly as plain strings.
  && form.value.endTime <= form.value.startTime)

const canSave = computed(() =>
  form.value.title.trim() !== ''
  && form.value.location.trim() !== ''
  && dateValid.value
  && !endWithoutStart.value
  && !endBeforeStart.value)

/** Reads back what will be shown on the schedule, so there is no surprise. */
const timePreview = computed(() => {
  if (form.value.allDay) return 'All Day'
  if (form.value.startTime && form.value.endTime) {
    return `${formatTime(form.value.startTime)} \u2013 ${formatTime(form.value.endTime)}`
  }
  if (form.value.startTime) return formatTime(form.value.startTime)
  return 'No time shown'
})

function handleSave() {
  const date = parseUsDate(form.value.date)
  if (!date || !canSave.value) return

  const payload: EventFormPayload = {
    title: form.value.title.trim(),
    date,
    location: form.value.location.trim(),
    type: form.value.type,
    allDay: form.value.allDay,
    // Blanks are sent rather than omitted: on an edit an absent key leaves the
    // old value in place, so clearing a time would silently fail.
    startTime: form.value.allDay ? '' : form.value.startTime,
    endTime: form.value.allDay ? '' : form.value.endTime,
    // Canonicalised so "both" or "all squads" typed by hand does not become a
    // squad name of its own.
    group: isAllGroups(form.value.group) ? ALL_GROUPS : cleanGroup(form.value.group),
    opponent: form.value.opponent.trim(),
    description: form.value.description.trim(),
  }

  emit('save', payload)
}

function reset() {
  form.value = blankForm()
}

defineExpose({ reset })
</script>

<template>
  <q-form class="q-gutter-md" @submit.prevent="handleSave">
    <q-input v-model="form.title" label="Event Title *" required outlined />

    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.date"
          label="Date *"
          mask="##-##-####"
          placeholder="MM-DD-YYYY"
          :error="form.date !== '' && !dateValid"
          error-message="Enter a real date as MM-DD-YYYY"
          outlined
        >
          <template #append>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="form.date" mask="MM-DD-YYYY" />
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
      </div>

      <div class="col-12 col-sm-6">
        <q-checkbox v-model="form.allDay" label="All day" dense class="q-mb-sm" />
        <div class="row q-col-gutter-sm">
          <div class="col-6">
            <TimeField
              v-model="form.startTime"
              label="Start"
              :disable="form.allDay"
            />
          </div>
          <div class="col-6">
            <TimeField
              v-model="form.endTime"
              label="End"
              :disable="form.allDay"
            />
          </div>
        </div>

        <div v-if="endWithoutStart" class="field-error">
          Add a start time, or clear the end time.
        </div>
        <div v-else-if="endBeforeStart" class="field-error">
          The end time must be after the start time.
        </div>
        <div v-else class="field-hint">
          Shows as: {{ timePreview }}
        </div>
      </div>
    </div>

    <q-input v-model="form.location" label="Location / Venue *" required outlined />

    <q-select
      v-model="form.type"
      :options="eventTypes"
      label="Type *"
      emit-value
      map-options
      outlined
    />

    <q-select
      v-model="groupModel"
      :options="groupOptions"
      label="Squad / Group"
      hint="TBI, NS, or ALL for both. Leave blank to show no squad on the event."
      outlined
      clearable
      use-input
      fill-input
      hide-selected
      new-value-mode="add-unique"
      input-debounce="0"
      @filter="filterGroups"
    />

    <q-input v-model="form.opponent" label="Opponent (if applicable)" outlined />

    <q-input
      v-model="form.description"
      type="textarea"
      label="Description / Notes"
      autogrow
      outlined
    />

    <div class="row q-gutter-sm justify-end">
      <q-btn flat label="Cancel" @click="emit('cancel')" />
      <q-btn
        type="submit"
        :label="modelValue?.id ? 'Update Event' : 'Create Event'"
        color="primary"
        :disable="!canSave"
        :loading="loading"
      />
    </div>
  </q-form>
</template>

<style scoped>
.field-error {
  font-size: 0.78rem;
  color: var(--negative, #c10015);
  margin-top: 6px;
}

.field-hint {
  font-size: 0.78rem;
  color: var(--grey-500);
  margin-top: 6px;
}
</style>
