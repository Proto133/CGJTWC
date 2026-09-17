<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Dialog, date, copyToClipboard, Notify } from 'quasar'
import { useRegistrationsStore } from 'stores/registrations'
import { useWrestlersStore } from 'stores/wrestlers'
import { registrationWrestlers, wrestlerNames, toUsDate } from 'src/utils/registration'
import { nameMatches } from 'src/utils/registrantConversion'
import PaymentDialog from 'components/admin/PaymentDialog.vue'
import ConvertRegistrantDialog from 'components/admin/ConvertRegistrantDialog.vue'
import type {
  Registration,
  RegistrationStatus,
  RegistrationWrestler,
  PaymentStatus,
  PaymentConfirmationInput,
} from 'src/types'

const store = useRegistrationsStore()
const wrestlersStore = useWrestlersStore()

// ---------------------------------------------------------------------------
// Registrant to wrestler
// ---------------------------------------------------------------------------

const convertOpen = ref(false)
const convertReg = ref<Registration | null>(null)
const convertRegistrant = ref<RegistrationWrestler | null>(null)

function openConvert(reg: Registration, w: RegistrationWrestler) {
  convertReg.value = reg
  convertRegistrant.value = w
  convertOpen.value = true
}

/**
 * Whether this child looks like they are already on the roster.
 *
 * Name only, which is all the public half of a wrestler holds. It is a hint to
 * stop an admin opening the dialog for someone already enrolled, not the
 * decision — the dialog checks dates of birth before it will write anything.
 */
function onRoster(w: RegistrationWrestler): boolean {
  return nameMatches(wrestlersStore.wrestlers, w).length > 0
}

const statusFilter = ref<RegistrationStatus | 'all'>('all')
const paymentFilter = ref<PaymentStatus | 'all'>('all')
/** Free-text lookup, for "a parent rang and lost their reference code". */
const search = ref('')
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

const VOLUNTEER_LABELS = {
  assistantCoach: 'Assistant Coach',
  fundraisers: 'Fundraisers',
  sponsorships: 'Sponsorships',
  homeTournament: 'Home Tournament',
} as const

/** Only the roles actually ticked, as readable labels. */
function volunteerRoles(reg: Registration): string[] {
  const v = reg.volunteer
  if (!v) return []
  return (Object.keys(VOLUNTEER_LABELS) as (keyof typeof VOLUNTEER_LABELS)[])
    .filter((key) => v[key])
    .map((key) => VOLUNTEER_LABELS[key])
}

const statusColors: Record<RegistrationStatus, string> = {
  new: 'primary',
  contacted: 'warning',
  registered: 'positive',
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()

  return store.registrations.filter((r) => {
    const byStatus = statusFilter.value === 'all' || r.status === statusFilter.value
    // Registrations submitted before payment tracking have no payment block.
    const payStatus = r.payment?.status ?? 'unpaid'
    const byPayment = paymentFilter.value === 'all' || payStatus === paymentFilter.value

    // Match on the things someone would have to hand on a phone call.
    // wrestlerNames covers every child on the submission, not just the first.
    const haystack = [
      wrestlerNames(r),
      r.guardian.firstName,
      r.guardian.lastName,
      r.guardian.email,
      r.guardian.phone,
      r.payment?.reference,
    ].filter(Boolean).join(' ').toLowerCase()

    const bySearch = term === '' || haystack.includes(term)

    return byStatus && byPayment && bySearch
  })
})

const owed = computed(() => store.registrations
  .filter((r) => r.payment && r.payment.status !== 'paid' && r.payment.status !== 'waived')
  .reduce((sum, r) => sum + (r.payment?.amountDue ?? 0), 0))

const collected = computed(() => store.registrations
  .filter((r) => r.payment?.status === 'paid')
  .reduce((sum, r) => sum + (r.payment?.amountReceived ?? 0), 0))

// ---------------------------------------------------------------------------
// Printable payment checklist
// ---------------------------------------------------------------------------

/**
 * Sorted by guardian surname, not by when they signed up.
 *
 * The sheet is used at a meeting to look a family up while they are standing
 * there, which is an alphabetical task. Submission order is useless for that.
 */
const printRows = computed(() =>
  [...filtered.value].sort((a, b) => {
    const byLast = (a.guardian?.lastName ?? '').localeCompare(b.guardian?.lastName ?? '')
    if (byLast !== 0) return byLast
    return (a.guardian?.firstName ?? '').localeCompare(b.guardian?.firstName ?? '')
  }))

/** Only what is actually outstanding on the printed rows. */
const printOwed = computed(() => printRows.value
  .filter((r) => r.payment && r.payment.status !== 'paid' && r.payment.status !== 'waived')
  .reduce((sum, r) => sum + (r.payment?.amountDue ?? 0), 0))

const printedOn = computed(() => date.formatDate(new Date(), 'MM-DD-YYYY'))

/**
 * Rendered only while printing, and teleported to the body.
 *
 * Teleporting is what makes the print stylesheet simple: the sheet becomes a
 * direct child of body, so print CSS can hide every sibling rather than trying
 * to unpick the dashboard's header, tabs and drawer one selector at a time.
 */
const printing = ref(false)

async function printRoster() {
  printing.value = true
  document.body.classList.add('printing-roster')
  // The node has to exist before the print dialog is opened.
  await nextTick()
  window.print()
}

function endPrint() {
  printing.value = false
  document.body.classList.remove('printing-roster')
}

// afterprint fires whether the dialog was confirmed or cancelled, which is the
// only reliable signal that printing is over.
onMounted(() => {
  window.addEventListener('afterprint', endPrint)
  // The roster is read here only to tell which registrants are already on it.
  wrestlersStore.subscribe()
})
onBeforeUnmount(() => {
  window.removeEventListener('afterprint', endPrint)
  // Leaving the tab mid-print would otherwise strand the body class.
  endPrint()
  wrestlersStore.unsubscribeFromWrestlers()
})

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
    message: `This permanently removes the submission for ${wrestlerNames(reg)}.`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void store.remove(reg.id)
  })
}

/** Re-exported for the template. */
const wrestlersOf = registrationWrestlers
const usDate = toUsDate
const namesOf = wrestlerNames
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

    <q-input
      v-model="search"
      dense
      outlined
      clearable
      class="q-mb-md"
      placeholder="Search name, email, phone or reference code"
    >
      <template #prepend>
        <q-icon name="search" />
      </template>
    </q-input>

    <div class="privacy-banner">
      <q-icon name="lock" size="16px" class="q-mr-xs" />
      These records contain a minor's date of birth and home address. They are
      readable by admins only. Consider deleting them once a wrestler is enrolled.
    </div>

    <!-- Above the loading branch, not inside it: dropping an element between a
         v-if and its v-else-if severs the chain. -->
    <div class="print-bar">
      <q-btn
        outline
        dense
        no-caps
        icon="print"
        label="Print checklist"
        :disable="printRows.length === 0"
        @click="printRoster"
      />
      <span class="print-bar__note">
        Prints the {{ printRows.length }} shown above, A–Z by family name, with a
        column to tick off payments.
      </span>
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
              {{ namesOf(reg) }}
              <!-- Count rather than every grade: a family of four would
                   otherwise make this row unreadable. -->
              <span class="text-caption text-grey-6">
                <template v-if="wrestlersOf(reg).length > 1">
                  · {{ wrestlersOf(reg).length }} wrestlers
                </template>
                <template v-else-if="wrestlersOf(reg).length === 1">
                  · Grade {{ wrestlersOf(reg)[0]?.grade }}
                </template>
              </span>
            </q-item-label>
            <q-item-label caption>
              {{ submittedOn(reg) }}
              <!-- Surfaced on the collapsed row so a lost code can be read out
                   without expanding. Click copies; stop propagation so it does
                   not toggle the row. -->
              <template v-if="reg.payment?.reference">
                ·
                <button
                  type="button"
                  class="ref-chip"
                  :title="`Copy ${reg.payment.reference}`"
                  @click.stop="copyReference(reg.payment.reference)"
                >
                  {{ reg.payment.reference }}
                </button>
              </template>
            </q-item-label>
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
              <div class="detail__label">
                {{ wrestlersOf(reg).length > 1 ? 'Wrestlers' : 'Wrestler' }}
              </div>
              <div
                v-for="(w, i) in wrestlersOf(reg)"
                :key="i"
                class="wrestler-detail"
              >
                <div class="row items-center q-gutter-xs">
                  <span class="text-weight-medium">{{ w.firstName }} {{ w.lastName }}</span>
                  <q-badge v-if="onRoster(w)" outline color="positive" label="on roster" />
                </div>
                <div>Born {{ usDate(w.dob) }} · Grade {{ w.grade }}</div>
                <div v-if="w.yearsExperience">Experience: {{ w.yearsExperience }}</div>
                <div v-if="w.previousClub">Previous club: {{ w.previousClub }}</div>
                <!-- Only on registrations taken while the question existed. -->
                <div v-if="w.siblingName">Sibling: {{ w.siblingName }}</div>
                <div v-if="w.usawNumber">USAW #{{ w.usawNumber }}</div>

                <!-- Per child rather than per family: siblings are routinely in
                     different situations, one returning and one new. -->
                <q-btn
                  dense
                  flat
                  no-caps
                  size="sm"
                  color="primary"
                  icon="person_add"
                  :label="onRoster(w) ? 'Review on roster' : 'Add to roster'"
                  class="convert-btn"
                  @click="openConvert(reg, w)"
                />
              </div>
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
            <!-- The actionable part for the club: who has offered to help. -->
            <div v-if="reg.volunteer" class="col-12 col-sm-6">
              <div class="detail__label">Volunteering</div>
              <div v-if="!reg.volunteer.interested" class="text-grey-6">
                Not interested
              </div>
              <template v-else>
                <div v-if="volunteerRoles(reg).length">
                  <q-badge
                    v-for="role in volunteerRoles(reg)"
                    :key="role"
                    color="positive"
                    class="vol-badge"
                  >
                    {{ role }}
                  </q-badge>
                </div>
                <div v-else>Interested, no specific role chosen</div>
              </template>
            </div>

            <div v-if="reg.referralSource" class="col-12 col-sm-6">
              <div class="detail__label">Heard about us via</div>
              <div>{{ reg.referralSource }}</div>
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
                  <button
                    type="button"
                    class="ref-code"
                    :aria-label="`Copy reference ${reg.payment.reference}`"
                    @click="copyReference(reg.payment.reference)"
                  >
                    {{ reg.payment.reference }}
                    <q-icon name="content_copy" size="14px" />
                  </button>
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

    <!-- Teleported so the print stylesheet can hide everything that is not
         this, rather than chasing the dashboard's chrome selector by selector. -->
    <Teleport to="body">
      <div v-if="printing" class="roster-print">
        <header class="roster-print__head">
          <h1>Payment checklist</h1>
          <div class="roster-print__meta">
            {{ printRows.length }} famil{{ printRows.length === 1 ? 'y' : 'ies' }}
            · ${{ printOwed }} outstanding · printed {{ printedOn }}
          </div>
        </header>

        <table class="roster-print__table">
          <thead>
            <tr>
              <th class="col-tick">Paid</th>
              <th>Family</th>
              <th>Wrestlers</th>
              <th>Reference</th>
              <th class="col-num">Owed</th>
              <th class="col-write">Received</th>
              <th class="col-write">Method / notes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="reg in printRows" :key="reg.id">
              <td class="col-tick"><span class="tickbox"></span></td>
              <td>
                {{ reg.guardian?.lastName }}, {{ reg.guardian?.firstName }}
                <div class="roster-print__sub">{{ reg.guardian?.phone }}</div>
              </td>
              <td>{{ wrestlerNames(reg) }}</td>
              <td class="col-ref">{{ reg.payment?.reference }}</td>
              <td class="col-num">
                <template v-if="reg.payment?.status === 'paid'">paid</template>
                <template v-else-if="reg.payment?.status === 'waived'">waived</template>
                <template v-else>${{ reg.payment?.amountDue ?? 0 }}</template>
              </td>
              <td class="col-write"></td>
              <td class="col-write"></td>
            </tr>
          </tbody>
        </table>

        <p class="roster-print__foot">
          Total outstanding on this sheet: ${{ printOwed }}
        </p>
      </div>
    </Teleport>

    <PaymentDialog
      v-model="paymentDialogOpen"
      :registration="editingPayment"
      :loading="store.working === editingPayment?.id"
      @save="savePayment"
    />

    <ConvertRegistrantDialog
      v-model="convertOpen"
      :registration="convertReg"
      :registrant="convertRegistrant"
    />
  </div>
</template>

<style scoped>
.vol-badge {
  margin: 0 4px 4px 0;
}

/* Separates siblings without a heavy divider per child. */
.wrestler-detail + .wrestler-detail {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--grey-200, #e5e7eb);
}

/* Pulled left of the text it belongs to so it reads as this child's action
   rather than the panel's. */
.convert-btn {
  margin: 4px 0 0 -6px;
}
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

.print-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.print-bar__note {
  font-size: 0.82rem;
  color: var(--grey-500);
}

/*
 * Never shown on screen, even while the print dialog is open, so the sheet
 * does not flash into the dashboard on the way to the printer.
 */
.roster-print {
  display: none;
}

@media print {
  .roster-print {
    display: block;
    font-family: var(--font-body);
    color: #000;
  }

  .roster-print__head h1 {
    font-size: 16pt;
    margin: 0;
  }

  .roster-print__meta {
    font-size: 9pt;
    color: #444;
    margin-bottom: 10pt;
  }

  .roster-print__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
  }

  /* Repeats the header on every page of a long list. */
  .roster-print__table thead {
    display: table-header-group;
  }

  .roster-print__table th,
  .roster-print__table td {
    border: 1px solid #999;
    padding: 5pt 6pt;
    text-align: left;
    vertical-align: top;
    /* Keeps a family's row off a page boundary. */
    page-break-inside: avoid;
  }

  .roster-print__table th {
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: #eee;
  }

  .roster-print__sub {
    font-size: 8pt;
    color: #555;
  }

  .col-tick {
    width: 34pt;
    text-align: center;
  }

  .tickbox {
    display: inline-block;
    width: 11pt;
    height: 11pt;
    border: 1pt solid #333;
  }

  .col-ref {
    font-family: monospace;
    white-space: nowrap;
  }

  .col-num {
    text-align: right;
    white-space: nowrap;
  }

  /* Left blank on purpose — these are written in by hand at the meeting. */
  .col-write {
    width: 78pt;
  }

  .roster-print__foot {
    margin-top: 10pt;
    font-size: 10pt;
    font-weight: 700;
  }
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

/* Both the chip and the detail code are buttons so the code itself is the
   click target, not just an adjacent icon. */
.ref-code {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid var(--grey-200);
  border-radius: 4px;
  padding: 2px 8px;
  font: inherit;
  font-weight: 600;
  color: var(--navy-800);
  cursor: pointer;
}

.ref-code:hover {
  border-color: var(--navy-800);
  background: var(--grey-050);
}

.ref-chip {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--navy-800);
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.ref-chip:hover {
  text-decoration-style: solid;
}
</style>
