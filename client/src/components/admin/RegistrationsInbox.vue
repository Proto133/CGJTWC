<script setup lang="ts">
import { computed, ref } from 'vue'
import { Dialog, date } from 'quasar'
import { useRegistrationsStore } from 'stores/registrations'
import type { Registration, RegistrationStatus } from 'src/types'

const store = useRegistrationsStore()

const statusFilter = ref<RegistrationStatus | 'all'>('all')

const statusColors: Record<RegistrationStatus, string> = {
  new: 'primary',
  contacted: 'warning',
  registered: 'positive',
}

const filtered = computed(() =>
  statusFilter.value === 'all'
    ? store.registrations
    : store.registrations.filter((r) => r.status === statusFilter.value))

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
            <q-badge :color="statusColors[reg.status]" class="status-badge">
              {{ reg.status }}
            </q-badge>
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
          </div>

          <div class="row items-center q-gutter-sm q-mt-md">
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
</style>
