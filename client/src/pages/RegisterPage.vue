<script setup lang="ts">
import { ref, computed } from 'vue'
import { copyToClipboard, Notify } from 'quasar'
import { useRegistrationsStore } from 'stores/registrations'
import { useSettingsStore } from 'stores/settings'
import { generatePaymentReference } from 'src/utils/reference'
import { toStoredDate, isValidUsDate } from 'src/utils/registration'
import { baseTiers, additionalRateFor, totalDue } from 'src/utils/pricing'
import type { PaymentMethod } from 'src/types'

const registrations = useRegistrationsStore()
const settings = useSettingsStore()
const org = computed(() => settings.org)
const pay = computed(() => settings.org.payment)

/** Only tiers an admin has actually filled in. */
const tiers = computed(() => pay.value.tiers.filter((t) => t.label.trim() !== ''))

/**
 * Tiers a parent may choose. Additional-wrestler rates are excluded on purpose:
 * they are not alternatives to the base fee but additions to it, so offering
 * one as a radio option would let a family owe only the sibling price for their
 * first child.
 */
const selectableTiers = computed(() => baseTiers(tiers.value))

/**
 * The extra-wrestler rate that pairs with whichever base tier was chosen. The
 * club can run more than one window at a time — a standard and a late sibling
 * rate — so this depends on the selection rather than being a single fixed id.
 */
const additionalTier = computed(() =>
  additionalRateFor(tiers.value, form.value.payment.tierId))

const methods: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'zelle', label: 'Zelle', icon: 'account_balance' },
  { value: 'check', label: 'Check', icon: 'edit_note' },
  { value: 'cash', label: 'Cash', icon: 'payments' },
]

const submitted = ref(false)
/** Shown on the confirmation screen so the payer can put it in the memo. */
const submittedReference = ref('')

function emptyWrestler() {
  return {
    firstName: '',
    lastName: '',
    // Held in MM-DD-YYYY while the parent types; converted on submit.
    dob: '',
    grade: '',
    yearsExperience: '',
    previousClub: '',
    usawNumber: '',
  }
}

function emptyForm() {
  return {
    wrestlers: [emptyWrestler()],
    guardian: { firstName: '', lastName: '', email: '', phone: '' },
    address: { street: '', city: '', state: '', postalCode: '' },
    emergency: { name: '', phone: '', relationship: '' },
    payment: { method: 'zelle' as PaymentMethod, tierId: '' },
    volunteer: {
      interested: false,
      assistantCoach: false,
      fundraisers: false,
      sponsorships: false,
      homeTournament: false,
    },
    referralSource: '',
    notes: '',
  }
}

const form = ref(emptyForm())

const required = (label: string) => (val: string) =>
  (val && val.trim().length > 0) || `${label} is required`

// Entered US-style. Rejects 02-31-2015, which a regex alone would accept.
const dobRule = (val: string) =>
  isValidUsDate(val) || 'Enter the date as MM-DD-YYYY'

const emailRule = (val: string) =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val) || 'Enter a valid email address'

const selectedTier = computed(() =>
  tiers.value.find((t) => t.id === form.value.payment.tierId) ?? null)

const wrestlerCount = computed(() => form.value.wrestlers.length)
const extraWrestlers = computed(() => Math.max(0, wrestlerCount.value - 1))

/** First wrestler at the chosen tier, each additional one at the paired rate. */
const amountDue = computed(() =>
  totalDue(tiers.value, form.value.payment.tierId, wrestlerCount.value))

/**
 * True when extra wrestlers cannot be priced because the club has not set an
 * additional-wrestler amount. Silently charging nothing for them would leave
 * the family underpaying with no warning, so this is surfaced instead.
 */
const additionalRateMissing = computed(() =>
  extraWrestlers.value > 0 && !(additionalTier.value?.amount))

function addWrestler() {
  form.value.wrestlers.push(emptyWrestler())
}

function removeWrestler(index: number) {
  // Never leave the form with nothing to submit.
  if (form.value.wrestlers.length <= 1) return
  form.value.wrestlers.splice(index, 1)
}

const volunteerRoles = [
  { key: 'assistantCoach', label: 'Assistant Coach' },
  { key: 'fundraisers', label: 'Coordinating Fundraisers' },
  { key: 'sponsorships', label: 'Coordinating Sponsorships' },
  { key: 'homeTournament', label: 'Coordinating Home Tournament' },
] as const

async function handleSubmit() {
  const f = form.value
  // Generated per submission; the payer writes it in the Zelle or cheque memo
  // so an admin can match a bank statement line back to this registration.
  const reference = generatePaymentReference()

  const ok = await registrations.submit({
    wrestlers: f.wrestlers.map((w) => ({
      firstName: w.firstName.trim(),
      lastName: w.lastName.trim(),
      // Converted from the MM-DD-YYYY the parent typed to the YYYY/MM/DD the
      // rules validate and the rest of the app sorts on.
      dob: toStoredDate(w.dob.trim()),
      grade: w.grade.trim(),
      // Spread so an unanswered optional never reaches Firestore as ''. The
      // rules cap their length but do not require them.
      ...(w.yearsExperience.trim()
        ? { yearsExperience: w.yearsExperience.trim() } : {}),
      ...(w.previousClub.trim()
        ? { previousClub: w.previousClub.trim() } : {}),
      ...(w.usawNumber.trim()
        ? { usawNumber: w.usawNumber.trim() } : {}),
    })),
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
    // Always sent, so the admin inbox can distinguish "said no" from "was
    // never asked" on older registrations.
    volunteer: {
      interested: f.volunteer.interested,
      // A role can only be true if they said yes; unticking "interested"
      // after checking roles must not leave stale flags behind.
      assistantCoach: f.volunteer.interested && f.volunteer.assistantCoach,
      fundraisers: f.volunteer.interested && f.volunteer.fundraisers,
      sponsorships: f.volunteer.interested && f.volunteer.sponsorships,
      homeTournament: f.volunteer.interested && f.volunteer.homeTournament,
    },
    ...(f.referralSource.trim() ? { referralSource: f.referralSource.trim() } : {}),
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
          <div class="form-section-title">
            {{ wrestlerCount > 1 ? 'Wrestlers' : 'Wrestler' }}
          </div>
          <p class="section-note">
            Registering more than one child? Add them all here — you only fill in
            your contact details once, and you get a single payment reference.
          </p>

          <div
            v-for="(wrestler, index) in form.wrestlers"
            :key="index"
            class="wrestler-block"
          >
            <div class="wrestler-block__head">
              <span class="wrestler-block__title">
                Wrestler {{ index + 1 }}
              </span>
              <!-- Only offered from the second card on: removing the only
                   wrestler would leave nothing to submit. -->
              <q-btn
                v-if="form.wrestlers.length > 1"
                dense
                flat
                no-caps
                size="sm"
                color="negative"
                icon="close"
                label="Remove"
                @click="removeWrestler(index)"
              />
            </div>

            <div class="row q-col-gutter-sm">
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="wrestler.firstName"
                  label="First Name *"
                  outlined
                  :rules="[required('First name')]"
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="wrestler.lastName"
                  label="Last Name *"
                  outlined
                  :rules="[required('Last name')]"
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="wrestler.dob"
                  label="Date of Birth *"
                  mask="##-##-####"
                  placeholder="MM-DD-YYYY"
                  outlined
                  :rules="[dobRule]"
                >
                  <template #append>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-date v-model="wrestler.dob" mask="MM-DD-YYYY" />
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="wrestler.grade"
                  label="Grade *"
                  outlined
                  hint="e.g. 4, or K"
                  :rules="[required('Grade')]"
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="wrestler.yearsExperience"
                  label="Years of Experience"
                  outlined
                  maxlength="40"
                  hint="e.g. first year, or 3 seasons"
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="wrestler.previousClub"
                  label="Previous Club Attended"
                  outlined
                  maxlength="120"
                  hint="Leave blank if this is their first club"
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="wrestler.usawNumber"
                  label="USAW Number"
                  outlined
                  maxlength="40"
                  hint="If they already have one"
                />
              </div>
            </div>
          </div>

          <q-btn
            outline
            no-caps
            color="primary"
            icon="person_add"
            label="Add a Wrestler"
            class="q-mt-sm"
            :disable="form.wrestlers.length >= 6"
            @click="addWrestler"
          />
          <div v-if="form.wrestlers.length >= 6" class="section-note q-mt-xs">
            That is the most this form takes at once — please contact us for a
            larger family and we will sort it out directly.
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

          <div class="form-section-title">Volunteering</div>
          <p class="section-note">
            The club runs on parent help. Nothing here is a commitment — it just
            tells us who to ask.
          </p>
          <q-toggle
            v-model="form.volunteer.interested"
            label="I'm interested in volunteering"
          />

          <!-- The specific roles are meaningless without a yes, so they stay
               hidden until then rather than sitting there greyed out. -->
          <div v-if="form.volunteer.interested" class="volunteer-roles">
            <div class="field-label">Which of these could you help with?</div>
            <q-checkbox
              v-for="role in volunteerRoles"
              :key="role.key"
              v-model="form.volunteer[role.key]"
              :label="role.label"
            />
          </div>

          <q-separator class="q-my-md" />

          <div class="form-section-title">How did you hear about us?</div>
          <q-input
            v-model="form.referralSource"
            outlined
            maxlength="200"
            placeholder="A friend, school, social media, a tournament..."
          />

          <q-separator class="q-my-md" />

          <div class="form-section-title">Payment</div>

          <!-- Above the options rather than under them: the deadline applies to
               every method and changes which one a family can realistically
               use, so it has to be read before the choice is made. -->
          <div v-if="pay.paymentDeadline" class="pay-deadline">
            <q-icon name="event_available" size="18px" class="pay-deadline__icon" />
            <div>{{ pay.paymentDeadline }}</div>
          </div>

          <div v-if="selectableTiers.length" class="q-mb-md">
            <q-option-group
              v-model="form.payment.tierId"
              type="radio"
              :options="selectableTiers.map((t) => ({
                label: t.amount > 0 ? `${t.label} — $${t.amount}` : t.label,
                value: t.id,
              }))"
              :rules="[required('A registration type')]"
            />
            <div v-if="selectedTier?.description" class="tier-hint">
              {{ selectedTier.description }}
            </div>

            <!-- Applied automatically rather than chosen: the extra-wrestler
                 rate is on top of the base fee, not instead of it. -->
            <div v-if="extraWrestlers > 0" class="fee-breakdown">
              <div class="fee-row">
                <span>{{ selectedTier?.label ?? 'Registration' }} (first wrestler)</span>
                <span>${{ selectedTier?.amount ?? 0 }}</span>
              </div>
              <div v-if="additionalTier?.amount" class="fee-row">
                <span>
                  {{ additionalTier.label }} &times; {{ extraWrestlers }}
                </span>
                <span>${{ extraWrestlers * additionalTier.amount }}</span>
              </div>
              <div class="fee-row fee-row--total">
                <span>Total for {{ wrestlerCount }} wrestlers</span>
                <span>${{ amountDue }}</span>
              </div>
            </div>

            <div v-if="additionalRateMissing" class="fee-warning">
              <q-icon name="info" size="16px" class="q-mr-xs" />
              We have not published an additional-wrestler rate yet, so the total
              above covers the first wrestler only. A coach will confirm the fee
              for the others before you pay.
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
              <!-- Deliberately not "any practice, any coach": cash is handled
                   at the parent meeting or by arrangement, and the deadline
                   above is what actually governs when it is due. -->
              <div>
                Cash can be brought to the parent meeting, or arranged with a
                Team Coordinator.
              </div>
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
.section-note {
  margin: 0 0 8px;
  font-size: 0.88rem;
  color: var(--grey-600, #6b7280);
}

/*
 * Deliberately heavier than .pay-note. This is a deadline with money attached,
 * and the copy it replaced ("bring cash to any practice") was being read as
 * open-ended, so it needs to carry more weight than a footnote.
 */
.pay-deadline {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid var(--grey-300);
  border-left: 4px solid var(--navy-800);
  border-radius: var(--radius-sm);
  background: var(--grey-050);
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--navy-900);
}

.pay-deadline__icon {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--navy-800);
}

/*
 * One per line, stacked from the container rather than the checkbox.
 * QCheckbox is itself an inline-flex holding the box and its label, so a
 * `display: block` on the component collapses that layout and drops the label
 * onto the line below the box. Stacking here leaves the component intact.
 */
.volunteer-roles {
  margin-top: 10px;
  padding-left: 4px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

/* The heading is a flex child now, so it needs its own full width. */
.volunteer-roles .field-label {
  width: 100%;
  margin-bottom: 2px;
}

.wrestler-block {
  border: 1px solid var(--grey-200, #e5e7eb);
  border-radius: var(--radius-md, 10px);
  padding: 12px;
  margin-bottom: 12px;
}

.wrestler-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.wrestler-block__title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--grey-500);
}

.fee-breakdown {
  margin-top: 12px;
  border-top: 1px solid var(--grey-200, #e5e7eb);
  padding-top: 10px;
}

.fee-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.92rem;
  padding: 3px 0;
}

.fee-row--total {
  font-weight: 700;
  border-top: 1px solid var(--grey-200, #e5e7eb);
  margin-top: 6px;
  padding-top: 8px;
}

.fee-warning {
  margin-top: 10px;
  font-size: 0.86rem;
  color: var(--grey-600, #6b7280);
}

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
