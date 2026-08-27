<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { date } from 'quasar'
import { wrestlerNames, toUsDate, toStoredDate, isValidUsDate } from 'src/utils/registration'
import type { Registration, PaymentStatus, PaymentConfirmationInput } from 'src/types'

const props = defineProps<{
  modelValue: boolean
  registration: Registration | null
  loading?: boolean | undefined
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void
  (e: 'save', payload: PaymentConfirmationInput): void
}>()

/**
 * Dates are held in the form as MM-DD-YYYY to match the rest of the UI, and
 * converted to the stored YYYY/MM/DD on save. Security rules validate the
 * stored form with a regex, so the conversion is not optional.
 */
const today = () => date.formatDate(new Date(), 'MM-DD-YYYY')

/** Exposed to the template. */
const namesOf = wrestlerNames

// Typed explicitly so `status` stays a PaymentStatus rather than widening to
// string, which would break the typed save payload.
interface PaymentFormState {
  status: PaymentStatus
  confirmationRef: string
  amountReceived: number
  receivedAt: string
  depositedAt: string
  notes: string
}

const form = ref<PaymentFormState>({
  status: 'paid',
  confirmationRef: '',
  amountReceived: 0,
  receivedAt: today(),
  depositedAt: '',
  notes: '',
})

const method = computed(() => props.registration?.payment?.method ?? 'zelle')

/**
 * The identifying detail differs by method, and is what makes a confirmed
 * payment traceable back to a line on the bank statement later.
 */
const refLabel = computed(() => {
  if (method.value === 'check') return 'Check number *'
  if (method.value === 'cash') return 'Receipt number *'
  return 'Zelle confirmation number *'
})

const refHint = computed(() => {
  if (method.value === 'check') return 'The number printed on the check'
  if (method.value === 'cash') return 'Your receipt book number, or who collected it'
  return 'From your bank\u2019s Zelle activity for this payment'
})

const isCheck = computed(() => method.value === 'check')

/** Confirmation detail is only required when actually marking something paid. */
const requiresDetail = computed(() => form.value.status === 'paid')

watch(() => props.registration, (reg) => {
  if (!reg) return
  const p = reg.payment
  form.value = {
    status: p?.status && p.status !== 'unpaid' ? p.status : 'paid',
    confirmationRef: p?.confirmationRef ?? '',
    amountReceived: p?.amountReceived ?? p?.amountDue ?? 0,
    // Stored values arrive as YYYY/MM/DD and are shown US-style.
    receivedAt: p?.receivedAt ? toUsDate(p.receivedAt) : today(),
    depositedAt: toUsDate(p?.depositedAt),
    notes: p?.notes ?? '',
  }
}, { immediate: true })

const dateRule = (v: string) =>
  isValidUsDate(v) || 'Use MM-DD-YYYY'

function handleSave() {
  emit('save', {
    status: form.value.status,
    confirmationRef: form.value.confirmationRef.trim(),
    amountReceived: Number(form.value.amountReceived) || 0,
    // Back to the stored format the rules require.
    receivedAt: toStoredDate(form.value.receivedAt),
    ...(isCheck.value && toStoredDate(form.value.depositedAt)
      ? { depositedAt: toStoredDate(form.value.depositedAt) }
      : {}),
    ...(form.value.notes.trim() ? { notes: form.value.notes.trim() } : {}),
  })
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="payment-dialog">
      <q-card-section>
        <div class="dialog-title">Record Payment</div>
        <div v-if="registration" class="dialog-sub">
          {{ namesOf(registration) }}
          <span v-if="registration.payment?.reference">
            · ref <strong>{{ registration.payment.reference }}</strong>
          </span>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-md">
        <q-select
          v-model="form.status"
          label="Payment status"
          outlined
          emit-value
          map-options
          :options="[
            { label: 'Paid', value: 'paid' },
            { label: 'Pending (sent, not yet cleared)', value: 'pending' },
            { label: 'Unpaid', value: 'unpaid' },
            { label: 'Waived', value: 'waived' },
          ]"
        />

        <div v-if="requiresDetail" class="detail-note">
          Marking a payment paid requires identifying details so it can be looked
          up later. The rules reject a confirmation without them.
        </div>

        <q-input
          v-model="form.confirmationRef"
          :label="refLabel"
          :hint="refHint"
          outlined
          :rules="requiresDetail ? [(v: string) => !!v.trim() || 'Required to confirm a payment'] : []"
        />

        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="form.amountReceived"
              type="number"
              label="Amount received *"
              prefix="$"
              outlined
              min="0"
              :rules="requiresDetail
                ? [(v: number) => Number(v) > 0 || 'Enter the amount received']
                : []"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.receivedAt"
              label="Date received *"
              mask="##-##-####"
              placeholder="MM-DD-YYYY"
              outlined
              :rules="requiresDetail ? [dateRule] : []"
            >
              <template #append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date v-model="form.receivedAt" mask="MM-DD-YYYY" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
        </div>

        <!-- Deposit date only makes sense for a physical check. -->
        <q-input
          v-if="isCheck"
          v-model="form.depositedAt"
          label="Date deposited"
          mask="##-##-####"
          placeholder="MM-DD-YYYY"
          outlined
        >
          <template #append>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="form.depositedAt" mask="MM-DD-YYYY" />
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>

        <q-input
          v-model="form.notes"
          type="textarea"
          label="Notes (optional)"
          outlined
          autogrow
        />
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancel" v-close-popup />
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Save payment"
          :loading="loading"
          @click="handleSave"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.payment-dialog {
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
  overflow-wrap: anywhere;
}

.detail-note {
  background: var(--grey-050);
  border: 1px solid var(--grey-200);
  border-left: 3px solid var(--navy-800);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 0.84rem;
  color: var(--grey-600);
  line-height: 1.5;
}
</style>
