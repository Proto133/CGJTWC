<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatTime, parseTimeCell } from 'src/utils/eventTimes'

/**
 * A time input that accepts what a person would actually type.
 *
 * The obvious implementation, a QInput with mask="time", forces 24-hour entry
 * and quietly turns a typed "4:15" into 04:15 — 4:15 in the morning. That is
 * precisely the ambiguity the spreadsheet importer refuses to guess at, so
 * accepting it silently here would be inconsistent and would put wrong times on
 * the public schedule.
 *
 * Instead the same parser runs on what was typed: "4:15 PM", "16:15" and
 * "4:15pm" are all understood, an ambiguous value is reported rather than
 * resolved, and the field normalises to a readable "4:15 PM" once accepted. The
 * model stays 'HH:MM' in 24-hour form, which is what gets stored and what QTime
 * binds to.
 */

const props = defineProps<{
  /** 'HH:MM' 24-hour, or '' when unset. */
  modelValue: string
  label: string
  disable?: boolean | undefined
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

/** What the admin sees and types. Normalised on blur. */
const text = ref('')
const error = ref('')

watch(() => props.modelValue, (value) => {
  // Only overwrite while the field is not mid-edit, so the picker and external
  // resets are reflected without fighting the keyboard.
  const canonical = formatTime(value)
  if (canonical !== text.value) text.value = canonical
  if (value !== '') error.value = ''
}, { immediate: true })

function commit() {
  const parsed = parseTimeCell(text.value)

  switch (parsed.kind) {
    case 'blank':
      error.value = ''
      text.value = ''
      emit('update:modelValue', '')
      return

    case 'time':
      error.value = ''
      text.value = formatTime(parsed.start)
      emit('update:modelValue', parsed.start)
      return

    case 'all-day':
      // Handled by the All day checkbox rather than by typing it in here, so
      // there is only ever one way to express it.
      error.value = 'Use the All day tickbox instead'
      return

    case 'ambiguous':
      error.value = 'Add AM or PM, or write it as 16:15'
      return

    default:
      error.value = 'Not a time. Try 4:15 PM or 16:15'
  }
}

/** QTime always speaks 'HH:MM', so it can drive the model directly. */
const pickerModel = ref(props.modelValue)

watch(() => props.modelValue, (value) => {
  pickerModel.value = value
})

watch(pickerModel, (value) => {
  if (value && value !== props.modelValue) {
    error.value = ''
    emit('update:modelValue', value)
  }
})
</script>

<template>
  <q-input
    v-model="text"
    :label="label"
    :disable="disable"
    :error="error !== ''"
    :error-message="error"
    outlined
    dense
    hide-bottom-space
    @blur="commit"
    @keydown.enter.prevent="commit"
  >
    <template #append>
      <q-icon name="access_time" class="cursor-pointer">
        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
          <!-- format24h is left unset so it follows the Quasar language pack,
               which gives an AM/PM clock for a US audience. -->
          <q-time v-model="pickerModel" />
        </q-popup-proxy>
      </q-icon>
    </template>
  </q-input>
</template>
