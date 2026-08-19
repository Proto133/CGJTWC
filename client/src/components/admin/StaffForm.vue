<script setup lang="ts">
import { ref, watch } from 'vue'
import type { StaffMember, StaffFormPayload } from 'src/types'

// `| undefined` is required because the project enables
// `exactOptionalPropertyTypes`, and the parent binds `editing || undefined`.
const props = defineProps<{
  modelValue?: Partial<StaffMember> | undefined
  loading?: boolean | undefined
}>()

const emit = defineEmits<{
  (e: 'save', payload: StaffFormPayload): void
  (e: 'cancel'): void
}>()

const form = ref({
  firstName: '',
  lastName: '',
  role: '',
  bio: '',
  order: 0,
  email: '',
})

watch(() => props.modelValue, (val) => {
  form.value = {
    firstName: val?.firstName ?? '',
    lastName: val?.lastName ?? '',
    role: val?.role ?? '',
    bio: val?.bio ?? '',
    order: val?.order ?? 0,
    email: val?.email ?? '',
  }
}, { immediate: true })

const required = (label: string) => (v: string) =>
  (v && v.trim().length > 0) || `${label} is required`

function handleSave() {
  emit('save', {
    firstName: form.value.firstName.trim(),
    lastName: form.value.lastName.trim(),
    role: form.value.role.trim(),
    bio: form.value.bio.trim(),
    order: Number(form.value.order) || 0,
    // Omit rather than send an empty string: the rules cap the length but the
    // field is optional, and a blank value would just be noise in the document.
    ...(form.value.email.trim() ? { email: form.value.email.trim() } : {}),
  })
}
</script>

<template>
  <q-form @submit.prevent="handleSave" class="q-gutter-md">
    <div class="row q-col-gutter-sm">
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.firstName"
          label="First Name *"
          outlined
          :rules="[required('First name')]"
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.lastName"
          label="Last Name *"
          outlined
          :rules="[required('Last name')]"
        />
      </div>
    </div>

    <q-input
      v-model="form.role"
      label="Role *"
      outlined
      hint="e.g. Head Coach, Assistant Coach, Team Parent"
      :rules="[required('Role')]"
    />

    <q-input
      v-model="form.bio"
      type="textarea"
      label="Bio"
      outlined
      autogrow
      counter
      maxlength="4000"
    />

    <div class="row q-col-gutter-sm">
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.email"
          type="email"
          label="Email (optional)"
          outlined
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-input
          v-model.number="form.order"
          type="number"
          label="Sort order"
          outlined
          min="0"
          max="999"
          hint="Lower numbers appear first"
        />
      </div>
    </div>

    <div class="row q-gutter-sm justify-end">
      <q-btn flat no-caps label="Cancel" @click="emit('cancel')" />
      <q-btn
        type="submit"
        no-caps
        unelevated
        :label="modelValue?.id ? 'Update Staff Member' : 'Add Staff Member'"
        color="primary"
        :loading="loading"
      />
    </div>
  </q-form>
</template>
