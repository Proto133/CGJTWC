<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Announcement, AnnouncementFormPayload } from 'src/types'

// `| undefined` is required because the project enables
// `exactOptionalPropertyTypes`, and the parent binds `editingAnnouncement || undefined`.
const props = defineProps<{
  modelValue?: Partial<Announcement> | undefined
  loading?: boolean | undefined
}>()

const emit = defineEmits<{
  (e: 'save', payload: AnnouncementFormPayload): void
  (e: 'cancel'): void
}>()

const form = ref({
  title: '',
  body: '',
  pinned: false,
})

watch(() => props.modelValue, (val) => {
  if (val) {
    form.value = {
      title: val.title || '',
      body: val.body || '',
      pinned: val.pinned ?? false,
    }
  }
}, { immediate: true })

function handleSave() {
  emit('save', { ...form.value })
}
</script>

<template>
  <q-form @submit.prevent="handleSave" class="q-gutter-md">
    <q-input v-model="form.title" label="Announcement Title *" required outlined />

    <q-input
      v-model="form.body"
      type="textarea"
      label="Message *"
      autogrow
      min-height="120px"
      required
      outlined
      hint="Keep it short and clear for parents and athletes"
    />

    <q-toggle v-model="form.pinned" label="Pin to top of announcements" />

    <div class="row q-gutter-sm justify-end q-mt-md">
      <q-btn flat label="Cancel" @click="emit('cancel')" />
      <q-btn
        type="submit"
        :label="modelValue?.id ? 'Update Announcement' : 'Publish Announcement'"
        color="primary"
        :loading="loading"
      />
    </div>
  </q-form>
</template>
