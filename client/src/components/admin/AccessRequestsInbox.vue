<script setup lang="ts">
import { Dialog, date } from 'quasar'
import { useAccessRequestsStore } from 'stores/accessRequests'
import { useAuthStore } from 'stores/auth'
import type { AccessRequest } from 'src/types'

const store = useAccessRequestsStore()
const authStore = useAuthStore()

function requestedOn(req: AccessRequest) {
  // createdAt is briefly null between the local write and the server echo.
  return req.createdAt
    ? date.formatDate(req.createdAt.toDate(), 'MMM D, YYYY h:mm A')
    : 'Just now'
}

function confirmApprove(req: AccessRequest) {
  Dialog.create({
    title: 'Grant admin access?',
    message:
      `${req.firstName} ${req.lastName} (${req.email}) will be able to create, ` +
      'edit and delete events, announcements and staff, read wrestler ' +
      'registrations, and change site settings.',
    ok: { label: 'Grant access', color: 'primary', unelevated: true, noCaps: true },
    cancel: { label: 'Cancel', flat: true, noCaps: true },
    persistent: true,
  }).onOk(() => {
    void store.approve(req)
  })
}

function confirmReject(req: AccessRequest) {
  Dialog.create({
    title: 'Decline request?',
    message:
      `This removes the request from ${req.firstName} ${req.lastName}. Their ` +
      'sign-in account still exists but stays without admin access, and they ' +
      'can request again later.',
    ok: { label: 'Decline', color: 'negative', unelevated: true, noCaps: true },
    cancel: { label: 'Cancel', flat: true, noCaps: true },
    persistent: true,
  }).onOk(() => {
    void store.reject(req)
  })
}
</script>

<template>
  <div>
    <div class="row items-center q-mb-md">
      <div class="text-h6">Access Requests</div>
      <q-space />
      <q-badge v-if="store.requests.length" color="primary">
        {{ store.requests.length }} pending
      </q-badge>
    </div>

    <div class="info-banner">
      <q-icon name="info" size="16px" class="q-mr-xs" />
      Approving creates the admin record keyed to the person's sign-in account.
      Access takes effect the next time they sign in.
    </div>

    <div v-if="store.loading" class="text-center q-pa-lg">
      <q-spinner color="primary" />
    </div>

    <div v-else-if="store.requests.length === 0" class="empty-state">
      No pending requests. People who use "Request admin access" on the login page
      will appear here.
    </div>

    <q-list v-else bordered separator class="rounded-borders">
      <q-item v-for="req in store.requests" :key="req.id" class="request-item">
        <q-item-section avatar>
          <q-avatar color="primary" text-color="white" size="40px">
            {{ req.firstName.charAt(0) }}{{ req.lastName.charAt(0) }}
          </q-avatar>
        </q-item-section>

        <q-item-section>
          <q-item-label class="text-weight-medium">
            {{ req.firstName }} {{ req.lastName }}
            <q-badge
              v-if="authStore.user?.email === req.email"
              color="warning"
              class="q-ml-sm"
            >
              You
            </q-badge>
          </q-item-label>
          <q-item-label caption>
            <a :href="`mailto:${req.email}`" class="request-link">{{ req.email }}</a>
            <template v-if="req.phone">
              ·
              <a :href="`tel:${req.phone}`" class="request-link">{{ req.phone }}</a>
            </template>
          </q-item-label>
          <q-item-label caption class="text-grey-6">
            Requested {{ requestedOn(req) }}
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <div class="row q-gutter-xs items-center">
            <q-btn
              dense
              unelevated
              no-caps
              color="primary"
              icon="check"
              label="Approve"
              :loading="store.working === req.id"
              @click="confirmApprove(req)"
            />
            <q-btn
              dense
              flat
              no-caps
              color="negative"
              icon="close"
              label="Decline"
              :disable="store.working === req.id"
              @click="confirmReject(req)"
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<style scoped>
.info-banner {
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

.request-item {
  padding-top: 12px;
  padding-bottom: 12px;
}

.request-link {
  overflow-wrap: anywhere;
}
</style>
