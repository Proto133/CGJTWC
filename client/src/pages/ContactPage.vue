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
  <q-page>
    <div class="page-shell page-shell--narrow">
      <header class="page-header">
        <div class="eyebrow">Get In Touch</div>
        <h1 class="page-title">Contact Us</h1>
        <p class="lead">
          Questions about the program, registration or volunteering? Reach out anytime.
        </p>
      </header>

      <q-card flat bordered class="q-pa-md">
        <q-form @submit.prevent="submitContact" class="q-gutter-md">
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
            unelevated
            no-caps
            size="lg"
            :loading="sending"
            class="full-width"
          />
        </q-form>
      </q-card>

      <section class="section">
        <h2 class="section-title">Find Us</h2>
        <div class="row q-col-gutter-md q-mt-md">
          <div class="col-12 col-sm-6">
            <div class="info-tile">
              <div class="info-tile__label">Practice Location</div>
              <div class="info-tile__value">
                Cary Grove Community Center<br />
                District 26 Schools<br />
                Cary, IL
              </div>
            </div>
          </div>
          <div class="col-12 col-sm-6">
            <div class="info-tile">
              <div class="info-tile__label">Reach Us</div>
              <div class="info-tile__value">
                <a href="mailto:admin@trojanswrestlingclub.com" class="info-link">
                  admin@trojanswrestlingclub.com
                </a>
                <br />
                <a
                  href="https://x.com/CGJTWrestling"
                  target="_blank"
                  rel="noopener"
                  class="info-link"
                >@CGJTWrestling on X</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </q-page>
</template>

<style scoped>
.info-tile {
  border: 1px solid var(--grey-200);
  border-radius: var(--radius-md);
  background: #fff;
  padding: 1rem 1.1rem;
  height: 100%;
}

.info-tile__label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--grey-400);
  margin-bottom: 8px;
}

.info-tile__value {
  font-size: 0.94rem;
  line-height: 1.6;
  color: var(--grey-600);
}

.info-link {
  /* Long email addresses must wrap instead of widening the page. */
  overflow-wrap: anywhere;
}
</style>
