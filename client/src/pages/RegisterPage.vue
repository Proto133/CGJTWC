<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRegistrationsStore } from 'stores/registrations'
import { useSettingsStore } from 'stores/settings'

const registrations = useRegistrationsStore()
const settings = useSettingsStore()
const org = computed(() => settings.org)

const submitted = ref(false)

function emptyForm() {
  return {
    wrestler: { firstName: '', lastName: '', dob: '', grade: '' },
    guardian: { firstName: '', lastName: '', email: '', phone: '' },
    address: { street: '', city: '', state: '', postalCode: '' },
    emergency: { name: '', phone: '', relationship: '' },
    notes: '',
  }
}

const form = ref(emptyForm())

const required = (label: string) => (val: string) =>
  (val && val.trim().length > 0) || `${label} is required`

// Kept in sync with the dob regex in firestore.rules.
const dobRule = (val: string) =>
  /^\d{4}\/\d{2}\/\d{2}$/.test(val) || 'Use the date picker (YYYY/MM/DD)'

const emailRule = (val: string) =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val) || 'Enter a valid email address'

async function handleSubmit() {
  const f = form.value
  const ok = await registrations.submit({
    wrestler: {
      firstName: f.wrestler.firstName.trim(),
      lastName: f.wrestler.lastName.trim(),
      dob: f.wrestler.dob.trim(),
      grade: f.wrestler.grade.trim(),
    },
    guardian: {
      firstName: f.guardian.firstName.trim(),
      lastName: f.guardian.lastName.trim(),
      email: f.guardian.email.trim(),
      phone: f.guardian.phone.trim(),
    },
    address: {
      street: f.address.street.trim(),
      city: f.address.city.trim(),
      state: f.address.state.trim(),
      postalCode: f.address.postalCode.trim(),
    },
    emergency: {
      name: f.emergency.name.trim(),
      phone: f.emergency.phone.trim(),
      relationship: f.emergency.relationship.trim(),
    },
    ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
  })

  if (ok) {
    submitted.value = true
    form.value = emptyForm()
  }
}

function startAnother() {
  submitted.value = false
}
</script>

<template>
  <q-page>
    <div class="page-shell page-shell--narrow">
      <header class="page-header">
        <div class="eyebrow">Join the Team</div>
        <h1 class="page-title">Wrestler Registration</h1>
        <p class="lead">
          Tell us about your wrestler and we will follow up with next steps.
        </p>
      </header>

      <!-- Confirmation state -->
      <q-card v-if="submitted" flat bordered class="q-pa-lg text-center">
        <q-icon name="check_circle" color="positive" size="52px" />
        <h2 class="confirm-title">Registration received</h2>
        <p class="confirm-text">
          Thanks! A coach will reach out using the contact details you provided.
          Questions in the meantime? Email
          <a :href="settings.mailtoHref">{{ org.contact.email }}</a>.
        </p>
        <div class="q-gutter-sm">
          <q-btn to="/" label="Back to home" color="primary" unelevated no-caps />
          <q-btn label="Register another wrestler" flat no-caps @click="startAnother" />
        </div>
      </q-card>

      <!-- Form -->
      <q-form v-else @submit.prevent="handleSubmit">
        <q-card flat bordered class="q-pa-md">
          <div class="form-section-title">Wrestler</div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.wrestler.firstName"
                label="First Name *"
                outlined
                :rules="[required('First name')]"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.wrestler.lastName"
                label="Last Name *"
                outlined
                :rules="[required('Last name')]"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.wrestler.dob"
                label="Date of Birth *"
                mask="####/##/##"
                placeholder="YYYY/MM/DD"
                outlined
                :rules="[dobRule]"
              >
                <template #append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="form.wrestler.dob" mask="YYYY/MM/DD" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.wrestler.grade"
                label="Grade *"
                outlined
                hint="e.g. 4, or K"
                :rules="[required('Grade')]"
              />
            </div>
          </div>

          <q-separator class="q-my-md" />

          <div class="form-section-title">Parent or Guardian</div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.guardian.firstName"
                label="First Name *"
                outlined
                :rules="[required('First name')]"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.guardian.lastName"
                label="Last Name *"
                outlined
                :rules="[required('Last name')]"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.guardian.email"
                type="email"
                label="Email *"
                outlined
                :rules="[emailRule]"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.guardian.phone"
                type="tel"
                label="Phone *"
                outlined
                :rules="[required('Phone')]"
              />
            </div>
          </div>

          <q-separator class="q-my-md" />

          <div class="form-section-title">Home Address</div>
          <div class="row q-col-gutter-sm">
            <div class="col-12">
              <q-input
                v-model="form.address.street"
                label="Street *"
                outlined
                :rules="[required('Street')]"
              />
            </div>
            <div class="col-12 col-sm-5">
              <q-input
                v-model="form.address.city"
                label="City *"
                outlined
                :rules="[required('City')]"
              />
            </div>
            <div class="col-6 col-sm-3">
              <q-input
                v-model="form.address.state"
                label="State *"
                outlined
                :rules="[required('State')]"
              />
            </div>
            <div class="col-6 col-sm-4">
              <q-input
                v-model="form.address.postalCode"
                label="ZIP *"
                outlined
                :rules="[required('ZIP')]"
              />
            </div>
          </div>

          <q-separator class="q-my-md" />

          <div class="form-section-title">Emergency Contact</div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.emergency.name"
                label="Full Name *"
                outlined
                :rules="[required('Name')]"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.emergency.phone"
                type="tel"
                label="Phone *"
                outlined
                :rules="[required('Phone')]"
              />
            </div>
            <div class="col-12">
              <q-input
                v-model="form.emergency.relationship"
                label="Relationship to Wrestler *"
                outlined
                hint="e.g. Grandparent, Aunt, Neighbour"
                :rules="[required('Relationship')]"
              />
            </div>
          </div>

          <q-separator class="q-my-md" />

          <q-input
            v-model="form.notes"
            type="textarea"
            label="Anything else we should know? (optional)"
            outlined
            autogrow
          />

          <q-btn
            type="submit"
            label="Submit Registration"
            color="primary"
            unelevated
            no-caps
            size="lg"
            class="full-width q-mt-lg"
            :loading="registrations.submitting"
          />

          <p class="privacy-note">
            These details are visible only to club administrators.
          </p>
        </q-card>
      </q-form>
    </div>
  </q-page>
</template>

<style scoped>
.form-section-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--navy-800);
  margin-bottom: 10px;
}

.confirm-title {
  font-size: 1.6rem;
  margin: 14px 0 8px;
}

.confirm-text {
  color: var(--grey-600);
  line-height: 1.6;
  margin: 0 auto 20px;
  max-width: 46ch;
  overflow-wrap: anywhere;
}

.privacy-note {
  margin: 14px 0 0;
  font-size: 0.8rem;
  color: var(--grey-400);
  text-align: center;
}
</style>
