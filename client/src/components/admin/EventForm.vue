<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { date } from 'quasar'
import { useEventsStore } from 'stores/events'
import { ALL_GROUPS, cleanGroup, isAllGroups } from 'src/utils/eventGroups'
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
  date: string
  time: string
  location: string
  type: EventType
  group: string
  opponent: string
  description: string
}

const form = ref<EventFormState>({
  title: '',
  date: date.formatDate(new Date(), 'YYYY/MM/DD'),
  time: '',
  location: '',
  type: 'dual',
  group: '',
  opponent: '',
  description: '',
})

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

watch(() => props.modelValue, (val) => {
  if (val) {
    form.value = {
      title: val.title || '',
      date: val.date ? date.formatDate(val.date.toDate(), 'YYYY/MM/DD') : date.formatDate(new Date(), 'YYYY/MM/DD'),
      time: val.time || '',
      location: val.location || '',
      type: val.type || 'dual',
      group: val.group || '',
      opponent: val.opponent || '',
      description: val.description || '',
    }
  }
}, { immediate: true })

function handleSave() {
  const payload = {
    ...form.value,
    date: new Date(form.value.date),
    // Canonicalised so "both" or "all squads" typed by hand does not become a
    // squad name of its own. Blank is kept rather than omitted: on an edit, an
    // absent key would leave the old value in place instead of clearing it.
    group: isAllGroups(form.value.group) ? ALL_GROUPS : cleanGroup(form.value.group),
  }
  emit('save', payload)
}

function reset() {
  form.value = {
    title: '', date: date.formatDate(new Date(), 'YYYY/MM/DD'), time: '', location: '',
    type: 'dual', group: '', opponent: '', description: '',
  }
}

defineExpose({ reset })
</script>

<template>
  <q-form @submit.prevent="handleSave" class="q-gutter-md">
    <q-input v-model="form.title" label="Event Title *" required outlined />

    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input v-model="form.date" label="Date *" mask="date" :rules="['date']" outlined>
          <template #append>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="form.date" mask="YYYY/MM/DD" />
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
      </div>
      <div class="col-12 col-sm-6">
        <q-input v-model="form.time" label="Time (optional)" placeholder="4:30 PM" outlined />
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
        :loading="loading"
      />
    </div>
  </q-form>
</template>
