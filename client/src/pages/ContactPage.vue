<script setup lang="ts">
import { ref } from 'vue'
import { Notify } from 'quasar'

const form = ref({
  name: '',
  email: '',
  message: '',
})
const sending = ref(false)

function submitContact() {
  sending.value = true
  // Placeholder - in real life you would call a Firebase Function or EmailJS here
  setTimeout(() => {
    Notify.create({
      type: 'positive',
      message: 'Thank you! Your message has been received. We will reply within 48 hours.',
    })
    form.value = { name: '', email: '', message: '' }
    sending.value = false
  }, 600)
}
</script>

<template>
  <q-page padding>
    <div style="max-width: 640px; margin: 0 auto;">
      <h1 class="section-title q-mb-lg">Contact Us</h1>

      <p class="text-body1">
        Questions about the program, registration, or volunteering? Reach out anytime.
      </p>

      <q-form @submit.prevent="submitContact" class="q-mt-lg q-gutter-md">
        <q-input v-model="form.name" label="Your Name" required outlined />
        <q-input v-model="form.email" type="email" label="Email Address" required outlined />
        <q-input
          v-model="form.message"
          type="textarea"
          label="Message"
          autogrow
          required
          outlined
        />

        <q-btn
          type="submit"
          label="Send Message"
          color="primary"
          :loading="sending"
          class="full-width"
        />
      </q-form>

      <div class="q-mt-xl text-body2 text-grey-7">
        <strong>Practice Location (placeholder)</strong><br>
        Cary Grove Community Center / District 26 Schools<br>
        Cary, IL<br><br>

        <strong>Email:</strong> admin@trojanswrestlingclub.com<br>
        <strong>Follow:</strong> @CGJTWrestling on X
      </div>
    </div>
  </q-page>
</template>

<style scoped>
</style>
