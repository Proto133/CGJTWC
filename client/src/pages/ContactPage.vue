<script setup lang="ts">
import { ref, computed } from 'vue'
import { Notify } from 'quasar'
import { useSettingsStore } from 'stores/settings'
import { useContactMessagesStore } from 'stores/contactMessages'

const settings = useSettingsStore()
const contactMessages = useContactMessagesStore()
const org = computed(() => settings.org)
const socialLinks = computed(() => settings.socialLinks)
const mailtoHref = computed(() => settings.mailtoHref)
const addressLines = computed(() => settings.addressLines)

const form = ref({
  name: '',
  email: '',
  message: '',
})

/**
 * Honeypot. Hidden from people but not from most bots, which fill in every
 * field they find. A submission with this set is dropped without a write.
 * Cheap first line of defence on an endpoint anyone can post to.
 */
const website = ref('')

const sending = computed(() => contactMessages.sending)

async function submitContact() {
  if (website.value !== '') {
    // Pretend it worked rather than telling a bot why it failed.
    form.value = { name: '', email: '', message: '' }
    return
  }

  const sent = await contactMessages.submit(form.value)

  if (sent) {
    Notify.create({
      type: 'positive',
      message: 'Thanks! Your message has been sent and a club admin will get back to you.',
      timeout: 6000,
    })
    form.value = { name: '', email: '', message: '' }
    return
  }

  // Never claim success on failure: the sender needs to know to try the email
  // address instead, rather than waiting for a reply that will never come.
  Notify.create({
    type: 'negative',
    timeout: 12000,
    message:
      `Sorry, your message could not be sent. Please email us directly at ` +
      `${org.value.contact.email}.`,
  })
}
</script>

<template>
  <q-page>
    <div class="page-shell page-shell--narrow">
      <header class="page-header">
        <div class="eyebrow">Get In Touch</div>
        <h1 class="page-title">Contact Us</h1>
        <p class="lead">{{ org.content.contactIntro }}</p>
      </header>

      <q-card flat bordered class="q-pa-md">
        <q-form @submit.prevent="submitContact" class="q-gutter-md">
          <q-input
            v-model="form.name"
            label="Your Name"
            required
            outlined
            maxlength="100"
            :disable="sending"
          />
          <q-input
            v-model="form.email"
            type="email"
            label="Email Address"
            required
            outlined
            maxlength="200"
            :disable="sending"
          />
          <q-input
            v-model="form.message"
            type="textarea"
            label="Message"
            autogrow
            required
            outlined
            maxlength="5000"
            :disable="sending"
          />

          <!-- Honeypot: hidden from people, tempting to bots. Not a q-input so
               nothing about it looks like a real field to a scraper. -->
          <input
            v-model="website"
            class="hp-field"
            type="text"
            name="website"
            tabindex="-1"
            autocomplete="off"
            aria-hidden="true"
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
                <div v-for="line in addressLines" :key="line">{{ line }}</div>
              </div>
            </div>
          </div>
          <div class="col-12 col-sm-6">
            <div class="info-tile">
              <div class="info-tile__label">Reach Us</div>
              <div class="info-tile__value">
                <div>
                  <a :href="mailtoHref" class="info-link">{{ org.contact.email }}</a>
                </div>
                <div v-if="org.contact.phone">
                  <a :href="`tel:${org.contact.phone}`" class="info-link">
                    {{ org.contact.phone }}
                  </a>
                </div>
                <div v-for="social in socialLinks" :key="social.key">
                  <a
                    :href="social.url"
                    target="_blank"
                    rel="noopener"
                    class="info-link"
                  >{{ social.handle }} on {{ social.label }}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </q-page>
</template>

<style scoped>
/* Hidden without display:none, which some bots skip over. */
.hp-field {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

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
