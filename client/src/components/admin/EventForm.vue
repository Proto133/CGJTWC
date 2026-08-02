<script setup lang="ts">
import { ref, watch } from 'vue'
import { date } from 'quasar'
import type { Event, EventType } from 'src/types'

// `| undefined` is required because the project enables
// `exactOptionalPropertyTypes`, and the parent binds `editingEvent || undefined`.
const props = defineProps<{
  modelValue?: Partial<Event> | undefined
  loading?: boolean | undefined
}>()

const emit = defineEmits<{
  (e: 'save', payload: any): void
  (e: 'cancel'): void
}>()

const form = ref({
  title: '',
  date: date.formatDate(new Date(), 'YYYY/MM/DD'),
  time: '',
  location: '',
  type: 'dual' as EventType,
  opponent: '',
  description: '',
})

const eventTypes: { label: string; value: EventType }[] = [
  { label: 'Practice', value: 'practice' },
  { label: 'Dual Match', value: 'dual' },
  { label: 'Tournament', value: 'tournament' },
  { label: 'Other', value: 'other' },
]

watch(() => props.modelValue, (val) => {
  if (val) {
    form.value = {
      title: val.title || '',
      date: val.date ? date.formatDate(val.date.toDate(), 'YYYY/MM/DD') : date.formatDate(new Date(), 'YYYY/MM/DD'),
      time: val.time || '',
      location: val.location || '',
      type: val.type || 'dual',
      opponent: val.opponent || '',
      description: val.description || '',
    }
  }
}, { immediate: true })

function handleSave() {
  const payload = {
    ...form.value,
    date: new Date(form.value.date),
  }
  emit('save', payload)
}

function reset() {
  form.value = {
    title: '', date: date.formatDate(new Date(), 'YYYY/MM/DD'), time: '', location: '',
    type: 'dual', opponent: '', description: '',
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
