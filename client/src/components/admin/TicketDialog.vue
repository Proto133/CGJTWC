<script setup lang="ts">
import { ref, watch } from 'vue'
import { useTicketsStore } from 'stores/tickets'
import type { TicketType, TicketPriority } from 'src/types'

const props = defineProps<{
  modelValue: boolean
  /** Prefilled with wherever the reporter was when they opened this. */
  pageUrl?: string | undefined
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void
}>()

const tickets = useTicketsStore()

interface TicketFormState {
  type: TicketType
  title: string
  description: string
  priority: TicketPriority
  pageUrl: string
  includePageUrl: boolean
}

function emptyForm(): TicketFormState {
  return {
    type: 'bug',
    title: '',
    description: '',
    priority: 'normal',
    pageUrl: props.pageUrl ?? '',
    includePageUrl: true,
  }
}

const form = ref<TicketFormState>(emptyForm())

// Re-seed each time it opens so the captured page is current.
watch(() => props.modelValue, (open) => {
  if (open) form.value = emptyForm()
})

async function handleSubmit() {
  const ok = await tickets.createTicket({
    type: form.value.type,
    title: form.value.title.trim(),
    description: form.value.description.trim(),
    priority: form.value.priority,
    ...(form.value.includePageUrl && form.value.pageUrl
      ? { pageUrl: form.value.pageUrl }
      : {}),
  })

  if (ok) emit('update:modelValue', false)
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="ticket-dialog">
      <q-form @submit.prevent="handleSubmit">
        <q-card-section>
          <div class="dialog-title">Report an issue</div>
          <div class="dialog-sub">Visible to admins only.</div>
        </q-card-section>

        <q-separator />

        <q-card-section class="q-gutter-md">
          <q-option-group
            v-model="form.type"
            type="radio"
            inline
            :options="[
              { label: 'Bug', value: 'bug' },
              { label: 'Feature request', value: 'feature' },
            ]"
          />

          <q-input
            v-model="form.title"
            label="Title *"
            outlined
            maxlength="140"
            counter
            :rules="[(v: string) => !!v.trim() || 'A short title is required']"
          />

          <q-input
            v-model="form.description"
            type="textarea"
            label="What happened, or what would you like?"
            outlined
            autogrow
            maxlength="5000"
          />

          <q-select
            v-model="form.priority"
            label="Priority"
            outlined
            emit-value
            map-options
            :options="[
              { label: 'Low', value: 'low' },
              { label: 'Normal', value: 'normal' },
              { label: 'High', value: 'high' },
            ]"
          />

          <q-checkbox
            v-model="form.includePageUrl"
            :label="`Include the page I was on (${form.pageUrl || 'unknown'})`"
          />
        </q-card-section>

        <q-separator />

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn
            type="submit"
            unelevated
            no-caps
            color="primary"
            label="Submit"
            :loading="tickets.working === 'new'"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.ticket-dialog {
  width: 100%;
  max-width: 520px;
}

.dialog-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.4rem;
  text-transform: uppercase;
  color: var(--navy-800);
}

.dialog-sub {
  font-size: 0.9rem;
  color: var(--grey-500);
  margin-top: 4px;
}
</style>
