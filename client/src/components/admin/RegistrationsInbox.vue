<script setup lang="ts">
import { computed, ref } from 'vue'
import { Dialog, date, copyToClipboard, Notify } from 'quasar'
import { useRegistrationsStore } from 'stores/registrations'
import PaymentDialog from 'components/admin/PaymentDialog.vue'
import type {
  Registration,
  RegistrationStatus,
  PaymentStatus,
  PaymentConfirmationInput,
} from 'src/types'

const store = useRegistrationsStore()

const statusFilter = ref<RegistrationStatus | 'all'>('all')
const paymentFilter = ref<PaymentStatus | 'all'>('all')
const paymentDialogOpen = ref(false)
const editingPayment = ref<Registration | null>(null)

const paymentColors: Record<PaymentStatus, string> = {
  unpaid: 'grey-6',
  pending: 'warning',
  paid: 'positive',
  waived: 'grey-7',
}

const methodLabels: Record<string, string> = {
  zelle: 'Zelle',
  check: 'Check',
  cash: 'Cash',
}

function openPaymentDialog(reg: Registration) {
  editingPayment.value = reg
  paymentDialogOpen.value = true
}

async function savePayment(input: PaymentConfirmationInput) {
  const reg = editingPayment.value
  if (!reg) return
  const ok = await store.recordPayment(reg.id, input)
  if (ok) paymentDialogOpen.value = false
}

async function copyReference(reference: string) {
  await copyToClipboard(reference)
  Notify.create({ type: 'info', message: `Copied ${reference}` })
}

const statusColors: Record<RegistrationStatus, string> = {
  new: 'primary',
  contacted: 'warning',
  registered: 'positive',
}

const filtered = computed(() => store.registrations.filter((r) => {
  const byStatus = statusFilter.value === 'all' || r.status === statusFilter.value
  // Registrations submitted before payment tracking have no payment block.
  const payStatus = r.payment?.status ?? 'unpaid'
  const byPayment = paymentFilter.value === 'all' || payStatus === paymentFilter.value
  return byStatus && byPayment
}))

const owed = computed(() => store.registrations
  .filter((r) => r.payment && r.payment.status !== 'paid' && r.payment.status !== 'waived')
  .reduce((sum, r) => sum + (r.payment?.amountDue ?? 0), 0))

const collected = computed(() => store.registrations
  .filter((r) => r.payment?.status === 'paid')
  .reduce((sum, r) => sum + (r.payment?.amountReceived ?? 0), 0))

const counts = computed(() => ({
  all: store.registrations.length,
  new: store.registrations.filter((r) => r.status === 'new').length,
  contacted: store.registrations.filter((r) => r.status === 'contacted').length,
  registered: store.registrations.filter((r) => r.status === 'registered').length,
}))

function submittedOn(reg: Registration) {
  // createdAt is briefly null between a local write and the server echo.
  return reg.createdAt
    ? date.formatDate(reg.createdAt.toDate(), 'MMM D, YYYY h:mm A')
    : 'Just now'
}

function confirmDelete(reg: Registration) {
  Dialog.create({
    title: 'Delete registration?',
    message:
      `This permanently removes the submission for ` +
      `${reg.wrestler.firstName} ${reg.wrestler.lastName}.`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void store.remove(reg.id)
  })
}
</script>

<template>
  <div>
    <div class="row items-center q-mb-md q-gutter-sm">
      <div class="text-h6">Registrations</div>
      <q-space />
      <q-btn-toggle
        v-model="statusFilter"
        no-caps
        unelevated
        dense
        toggle-color="primary"
        text-color="primary"
        color="white"
        class="status-toggle"
        :options="[
          { label: `All (${counts.all})`, value: 'all' },
          { label: `New (${counts.new})`, value: 'new' },
          { label: `Contacted (${counts.contacted})`, value: 'contacted' },
          { label: `Registered (${counts.registered})`, value: 'registered' },
        ]"
      />
    </div>

    <div class="row items-center q-mb-md q-gutter-sm">
      <q-btn-toggle
        v-model="paymentFilter"
        no-caps
        unelevated
        dense
        toggle-color="primary"
        text-color="primary"
        color="white"
        class="status-toggle"
        :options="[
          { label: 'Any payment', value: 'all' },
          { label: 'Unpaid', value: 'unpaid' },
          { label: 'Pending', value: 'pending' },
          { label: 'Paid', value: 'paid' },
          { label: 'Waived', value: 'waived' },
        ]"
      />
      <q-space />
      <div class="totals">
        <span class="totals__item">Collected <strong>${{ collected }}</strong></span>
        <span class="totals__item">Outstanding <strong>${{ owed }}</strong></span>
      </div>
    </div>

    <div class="privacy-banner">
      <q-icon name="lock" size="16px" class="q-mr-xs" />
      These records contain a minor's date of birth and home address. They are
      readable by admins only. Consider deleting them once a wrestler is enrolled.
    </div>

    <div v-if="store.loading" class="text-center q-pa-lg">
      <q-spinner color="primary" />
    </div>

    <div v-else-if="filtered.length === 0" class="empty-state">
      No registrations{{ statusFilter === 'all' ? ' yet' : ` with status "${statusFilter}"` }}.
    </div>

    <q-list v-else bordered separator class="rounded-borders">
      <q-expansion-item v-for="reg in filtered" :key="reg.id">
        <template #header>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              {{ reg.wrestler.firstName }} {{ reg.wrestler.lastName }}
              <span class="text-caption text-grey-6">· Grade {{ reg.wrestler.grade }}</span>
            </q-item-label>
            <q-item-label caption>{{ submittedOn(reg) }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="row q-gutter-xs items-center">
              <q-badge
                v-if="reg.payment"
                :color="paymentColors[reg.payment.status]"
                class="status-badge"
              >
                {{ reg.payment.status }}
              </q-badge>
              <q-badge :color="statusColors[reg.status]" class="status-badge">
                {{ reg.status }}
              </q-badge>
            </div>
          </q-item-section>
        </template>

        <div class="q-pa-md detail">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <div class="detail__label">Wrestler</div>
              <div>{{ reg.wrestler.firstName }} {{ reg.wrestler.lastName }}</div>
              <div>Born {{ reg.wrestler.dob }}</div>
              <div>Grade {{ reg.wrestler.grade }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="detail__label">Parent / Guardian</div>
              <div>{{ reg.guardian.firstName }} {{ reg.guardian.lastName }}</div>
              <div>
                <a :href="`mailto:${reg.guardian.email}`">{{ reg.guardian.email }}</a>
              </div>
              <div>
                <a :href="`tel:${reg.guardian.phone}`">{{ reg.guardian.phone }}</a>
              </div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="detail__label">Address</div>
              <div>{{ reg.address.street }}</div>
              <div>
                {{ reg.address.city }}, {{ reg.address.state }} {{ reg.address.postalCode }}
              </div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="detail__label">Emergency Contact</div>
              <div>{{ reg.emergency.name }} ({{ reg.emergency.relationship }})</div>
              <div>
                <a :href="`tel:${reg.emergency.phone}`">{{ reg.emergency.phone }}</a>
              </div>
            </div>
            <div v-if="reg.notes" class="col-12">
              <div class="detail__label">Notes</div>
              <div class="detail__notes">{{ reg.notes }}</div>
            </div>

            <!-- Payment. The reference is the key to matching a bank statement
                 line back to this registration, so it gets a copy button. -->
            <div v-if="reg.payment" class="col-12">
              <div class="detail__label">Payment</div>
              <div class="pay-grid">
                <div>
                  <span class="pay-key">Method</span>
                  {{ methodLabels[reg.payment.method] ?? reg.payment.method }}
                </div>
                <div>
                  <span class="pay-key">Amount due</span>
                  ${{ reg.payment.amountDue }}
                </div>
                <div class="pay-ref">
                  <span class="pay-key">Reference</span>
                  <code>{{ reg.payment.reference }}</code>
                  <q-btn
                    dense
                    flat
                    round
                    size="sm"
                    icon="content_copy"
                    :aria-label="`Copy reference ${reg.payment.reference}`"
                    @click="copyReference(reg.payment.reference)"
                  />
                </div>
                <template v-if="reg.payment.status === 'paid'">
                  <div>
                    <span class="pay-key">Confirmation</span>
                    {{ reg.payment.confirmationRef }}
                  </div>
                  <div>
                    <span class="pay-key">Received</span>
                    ${{ reg.payment.amountReceived }} on {{ reg.payment.receivedAt }}
                  </div>
                  <div v-if="reg.payment.depositedAt">
                    <span class="pay-key">Deposited</span>
                    {{ reg.payment.depositedAt }}
                  </div>
                  <div v-if="reg.payment.confirmedBy">
                    <span class="pay-key">Confirmed by</span>
                    {{ reg.payment.confirmedBy }}
                  </div>
                </template>
                <div v-if="reg.payment.notes" class="pay-full">
                  <span class="pay-key">Payment notes</span>
                  {{ reg.payment.notes }}
                </div>
              </div>
            </div>
            <div v-else class="col-12">
              <div class="detail__label">Payment</div>
              <div class="text-grey-6">
                Submitted before payment tracking was added.
              </div>
            </div>
          </div>

          <div class="row items-center q-gutter-sm q-mt-md">
            <q-btn
              v-if="reg.payment"
              dense
              unelevated
              no-caps
              color="primary"
              icon="payments"
              label="Record payment"
              :loading="store.working === reg.id"
              @click="openPaymentDialog(reg)"
            />
            <q-btn
              v-if="reg.status !== 'contacted'"
              dense
              flat
              no-caps
              icon="mark_email_read"
              label="Mark contacted"
              @click="store.setStatus(reg.id, 'contacted')"
            />
            <q-btn
              v-if="reg.status !== 'registered'"
              dense
              flat
              no-caps
              icon="how_to_reg"
              label="Mark registered"
              color="positive"
              @click="store.setStatus(reg.id, 'registered')"
            />
            <q-space />
            <q-btn
              dense
              flat
              no-caps
              icon="delete"
              label="Delete"
              color="negative"
              @click="confirmDelete(reg)"
            />
          </div>
        </div>
      </q-expansion-item>
    </q-list>

    <PaymentDialog
      v-model="paymentDialogOpen"
      :registration="editingPayment"
      :loading="store.working === editingPayment?.id"
      @save="savePayment"
    />
  </div>
</template>

<style scoped>
.privacy-banner {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  background: var(--grey-050);
  border: 1px solid var(--grey-200);
  border-left: 3px solid var(--navy-800);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 0.84rem;
  color: var(--grey-600);
  line-height: 1.5;
  margin-bottom: 14px;
}

.status-toggle {
  border: 1px solid var(--grey-200);
  border-radius: 999px;
  overflow: hidden;
}

.status-badge {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.66rem;
  font-weight: 600;
}

.detail {
  background: var(--grey-050);
}

.detail__label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.74rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--grey-400);
  margin-bottom: 4px;
}

.detail a {
  overflow-wrap: anywhere;
}

.detail__notes {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.totals {
  display: flex;
  gap: 14px;
  font-size: 0.85rem;
  color: var(--grey-600);
  flex-wrap: wrap;
}

.totals__item strong {
  color: var(--navy-800);
}

.pay-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 6px 16px;
}

.pay-full {
  grid-column: 1 / -1;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.pay-key {
  display: block;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--grey-400);
}

.pay-ref {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.pay-ref code {
  background: #fff;
  border: 1px solid var(--grey-200);
  border-radius: 4px;
  padding: 1px 6px;
  font-weight: 600;
}
</style>
