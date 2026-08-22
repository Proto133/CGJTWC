<script setup lang="ts">
import { ref, computed } from 'vue'
import { copyToClipboard, Notify } from 'quasar'
import { useRegistrationsStore } from 'stores/registrations'
import { useSettingsStore } from 'stores/settings'
import { generatePaymentReference } from 'src/utils/reference'
import type { PaymentMethod } from 'src/types'

const registrations = useRegistrationsStore()
const settings = useSettingsStore()
const org = computed(() => settings.org)
const pay = computed(() => settings.org.payment)

/** Only tiers an admin has actually filled in. */
const tiers = computed(() => pay.value.tiers.filter((t) => t.label.trim() !== ''))

const methods: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'zelle', label: 'Zelle', icon: 'account_balance' },
  { value: 'check', label: 'Check', icon: 'edit_note' },
  { value: 'cash', label: 'Cash', icon: 'payments' },
]

const submitted = ref(false)
/** Shown on the confirmation screen so the payer can put it in the memo. */
const submittedReference = ref('')

function emptyForm() {
  return {
    wrestler: { firstName: '', lastName: '', dob: '', grade: '' },
    guardian: { firstName: '', lastName: '', email: '', phone: '' },
    address: { street: '', city: '', state: '', postalCode: '' },
    emergency: { name: '', phone: '', relationship: '' },
    payment: { method: 'zelle' as PaymentMethod, tierId: '' },
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

const selectedTier = computed(() =>
  tiers.value.find((t) => t.id === form.value.payment.tierId) ?? null)

const amountDue = computed(() => selectedTier.value?.amount ?? 0)

async function handleSubmit() {
  const f = form.value
  // Generated per submission; the payer writes it in the Zelle or cheque memo
  // so an admin can match a bank statement line back to this registration.
  const reference = generatePaymentReference()

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
    payment: {
      method: f.payment.method,
      tierId: f.payment.tierId,
      // Snapshotted so a later price change does not rewrite what was owed.
      amountDue: amountDue.value,
      reference,
    },
    ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
  })

  if (ok) {
    submittedReference.value = reference
    submitted.value = true
    form.value = emptyForm()
  }
}

function startAnother() {
  submitted.value = false
}

/**
 * The code is the only thing tying a payment back to this registration, so make
 * it a single tap to get into a Zelle memo rather than something to transcribe.
 */
async function copyReference() {
  try {
    await copyToClipboard(submittedReference.value)
    Notify.create({
      type: 'positive',
      message: `Copied ${submittedReference.value} to your clipboard`,
    })
  } catch {
    // Clipboard access can be blocked (insecure context, or denied permission).
    Notify.create({
      type: 'warning',
      message: 'Could not copy automatically — please write the code down.',
    })
  }
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
        </p>

        <!-- The whole point of the reference code: it is how a payment gets
             matched back to this registration, so make it hard to miss. -->
        <div v-if="submittedReference" class="reference-box">
          <div class="reference-box__label">Your payment reference</div>
          <button type="button" class="reference-box__code" @click="copyReference">
            {{ submittedReference }}
            <q-icon name="content_copy" size="20px" />
          </button>
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            icon="content_copy"
            label="Copy code"
            @click="copyReference"
          />
          <p class="reference-box__hint">
            Put this in the memo when you pay so we can match your payment to
            your registration. If you lose it, contact us and we can look it up.
          </p>
        </div>

        <p class="confirm-text">
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

          <div class="form-section-title">Payment</div>

          <div v-if="tiers.length" class="q-mb-md">
            <q-option-group
              v-model="form.payment.tierId"
              type="radio"
              :options="tiers.map((t) => ({
                label: t.amount > 0 ? `${t.label} — $${t.amount}` : t.label,
                value: t.id,
              }))"
              :rules="[required('A registration type')]"
            />
            <div v-if="selectedTier?.description" class="tier-hint">
              {{ selectedTier.description }}
            </div>
          </div>
          <div v-else class="empty-state q-mb-md">
            Pricing has not been published yet. Submit your registration and a
            coach will follow up with the fee.
          </div>

          <div class="field-label">How will you pay?</div>
          <q-option-group
            v-model="form.payment.method"
            type="radio"
            inline
            :options="methods.map((m) => ({ label: m.label, value: m.value }))"
          />

          <!-- Method-specific instructions, all driven by admin settings. -->
          <div class="pay-instructions">
            <template v-if="form.payment.method === 'zelle'">
              <div v-if="pay.zelleTag">
                Send <strong v-if="amountDue">${{ amountDue }}</strong> by Zelle to
                <strong>{{ pay.zelleTag }}</strong>.
              </div>
              <div v-else>Zelle details will be emailed to you.</div>
              <img
                v-if="pay.zelleQrImageUrl"
                :src="pay.zelleQrImageUrl"
                alt="Zelle QR code"
                class="pay-qr"
              />
            </template>

            <template v-else-if="form.payment.method === 'check'">
              <div>
                Make the check payable to <strong>{{ pay.checkPayableTo }}</strong>.
              </div>
              <div v-if="pay.mailingAddress.length" class="q-mt-xs">
                Mail to:
                <div v-for="line in pay.mailingAddress" :key="line">{{ line }}</div>
              </div>
            </template>

            <template v-else>
              <div>Bring cash to any practice and hand it to a coach.</div>
            </template>

            <div v-if="pay.instructions" class="q-mt-sm">{{ pay.instructions }}</div>
            <div class="pay-note">
              You will get a reference code to include in the memo after you submit.
              Payment is confirmed by an admin once it arrives.
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

.field-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--grey-600);
  margin-bottom: 4px;
}

.tier-hint {
  font-size: 0.85rem;
  color: var(--grey-500);
  margin-top: 4px;
}

.pay-instructions {
  background: var(--grey-050);
  border: 1px solid var(--grey-200);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  margin-top: 10px;
  font-size: 0.92rem;
  line-height: 1.6;
  color: var(--grey-600);
  overflow-wrap: anywhere;
}

.pay-qr {
  display: block;
  margin-top: 10px;
  width: 160px;
  height: auto;
  border-radius: var(--radius-sm);
}

.pay-note {
  margin-top: 8px;
  font-size: 0.82rem;
  color: var(--grey-400);
}

.reference-box {
  border: 1px dashed var(--navy-800);
  border-radius: var(--radius-md);
  padding: 16px;
  margin: 0 auto 20px;
  max-width: 420px;
  background: var(--grey-050);
}

.reference-box__label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--grey-400);
}

.reference-box__code {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.7rem, 6vw, 2.2rem);
  letter-spacing: 0.08em;
  color: var(--navy-800);
  margin: 6px 0 4px;
  padding: 4px 12px;
  background: #fff;
  border: 1px solid var(--grey-200);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.reference-box__code:hover {
  border-color: var(--navy-800);
}

.reference-box__hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--grey-600);
  line-height: 1.55;
}
</style>
