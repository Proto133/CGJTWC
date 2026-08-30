<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useEventsStore } from 'stores/events'
import { useAnnouncementsStore } from 'stores/announcements'
import { useStaffStore } from 'stores/staff'
import { useRegistrationsStore } from 'stores/registrations'
import { useAccessRequestsStore } from 'stores/accessRequests'
import { useTicketsStore } from 'stores/tickets'
import { useVaultStore } from 'stores/vault'
import { useXMentionsStore } from 'stores/xMentions'
import { useContactMessagesStore } from 'stores/contactMessages'
import { useAuthStore } from 'stores/auth'
import EventForm from 'components/admin/EventForm.vue'
import AnnouncementForm from 'components/admin/AnnouncementForm.vue'
import StaffForm from 'components/admin/StaffForm.vue'
import SettingsForm from 'components/admin/SettingsForm.vue'
import RegistrationsInbox from 'components/admin/RegistrationsInbox.vue'
import AccessRequestsInbox from 'components/admin/AccessRequestsInbox.vue'
import FeedbackBoard from 'components/admin/FeedbackBoard.vue'
import AccountsVault from 'components/admin/AccountsVault.vue'
import MentionsQueue from 'components/admin/MentionsQueue.vue'
import MessagesInbox from 'components/admin/MessagesInbox.vue'
import EventImportDialog from 'components/admin/EventImportDialog.vue'
import EventBulkEditDialog from 'components/admin/EventBulkEditDialog.vue'
import type {
  Event,
  Announcement,
  StaffMember,
  EventFormPayload,
  AnnouncementFormPayload,
  StaffFormPayload,
} from 'src/types'
import { Dialog } from 'quasar'

type Tab =
  | 'events'
  | 'announcements'
  | 'staff'
  | 'registrations'
  | 'messages'
  | 'access'
  | 'mentions'
  | 'feedback'
  | 'accounts'
  | 'settings'

const tab = ref<Tab>('events')

const eventsStore = useEventsStore()
const announcementsStore = useAnnouncementsStore()
const staffStore = useStaffStore()
const registrationsStore = useRegistrationsStore()
const accessRequestsStore = useAccessRequestsStore()
const ticketsStore = useTicketsStore()
const vaultStore = useVaultStore()
const mentionsStore = useXMentionsStore()
const messagesStore = useContactMessagesStore()
const authStore = useAuthStore()

// Form state
const showEventForm = ref(false)
const editingEvent = ref<Partial<Event> | null>(null)
const showAnnouncementForm = ref(false)
const editingAnnouncement = ref<Partial<Announcement> | null>(null)
const showStaffForm = ref(false)
const editingStaff = ref<Partial<StaffMember> | null>(null)

// ----- Bulk event handling -----
const importOpen = ref(false)
const bulkEditOpen = ref(false)
/** Ids of ticked events. Cleared after any bulk action completes. */
const selectedEventIds = ref<string[]>([])

const allEventsSelected = computed(() =>
  eventsStore.events.length > 0
  && selectedEventIds.value.length === eventsStore.events.length)

function toggleEvent(id: string, checked: boolean) {
  selectedEventIds.value = checked
    ? [...selectedEventIds.value, id]
    : selectedEventIds.value.filter((existing) => existing !== id)
}

function toggleAllEvents(checked: boolean) {
  selectedEventIds.value = checked ? eventsStore.events.map((e) => e.id) : []
}

function confirmBulkDeleteEvents() {
  const count = selectedEventIds.value.length
  Dialog.create({
    title: `Delete ${count} event${count === 1 ? '' : 's'}?`,
    message: 'They are removed from the public schedule immediately. This cannot be undone.',
    cancel: true,
    persistent: true,
    ok: { label: `Delete ${count}`, color: 'negative', unelevated: true, noCaps: true },
  }).onOk(() => {
    void eventsStore.deleteMany([...selectedEventIds.value]).then((ok) => {
      if (ok) selectedEventIds.value = []
    })
  })
}

onMounted(() => {
  eventsStore.subscribe()
  announcementsStore.subscribe()
  staffStore.subscribe()
  // Admin-only: rules deny these reads to everyone else.
  registrationsStore.subscribe()
  accessRequestsStore.subscribe()
  ticketsStore.subscribe()
  vaultStore.subscribe()
  // Reads the whole mentions collection, including unapproved ones, which the
  // rules only permit for an admin.
  mentionsStore.subscribeQueue()
  messagesStore.subscribe()
})

onUnmounted(() => {
  eventsStore.unsubscribeFromEvents()
  announcementsStore.unsubscribeFromAnnouncements()
  staffStore.unsubscribeFromStaff()
  registrationsStore.unsubscribeFromRegistrations()
  accessRequestsStore.unsubscribeFromAccessRequests()
  ticketsStore.unsubscribeFromTickets()
  mentionsStore.unsubscribeFromXMentions()
  messagesStore.unsubscribeFromContactMessages()
  // Also discards the decryption key.
  vaultStore.unsubscribeFromVault()
})

// ----- Events -----
function openNewEvent() {
  editingEvent.value = null
  showEventForm.value = true
}

function openEditEvent(event: Event) {
  editingEvent.value = { ...event }
  showEventForm.value = true
}

async function saveEvent(payload: EventFormPayload) {
  const success = editingEvent.value?.id
    ? await eventsStore.updateEvent(editingEvent.value.id, payload)
    : await eventsStore.createEvent(payload)

  if (success) {
    showEventForm.value = false
    editingEvent.value = null
  }
}

function confirmDeleteEvent(id: string) {
  Dialog.create({
    title: 'Delete Event?',
    message: 'This action cannot be undone.',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void eventsStore.deleteEvent(id)
  })
}

// ----- Announcements -----
function openNewAnnouncement() {
  editingAnnouncement.value = null
  showAnnouncementForm.value = true
}

function openEditAnnouncement(a: Announcement) {
  editingAnnouncement.value = { ...a }
  showAnnouncementForm.value = true
}

async function saveAnnouncement(payload: AnnouncementFormPayload) {
  const success = editingAnnouncement.value?.id
    ? await announcementsStore.updateAnnouncement(editingAnnouncement.value.id, payload)
    : await announcementsStore.createAnnouncement(payload)

  if (success) {
    showAnnouncementForm.value = false
    editingAnnouncement.value = null
  }
}

function confirmDeleteAnnouncement(id: string) {
  Dialog.create({
    title: 'Delete Announcement?',
    message: 'This will remove it from the public site immediately.',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void announcementsStore.deleteAnnouncement(id)
  })
}

// ----- Staff -----
function openNewStaff() {
  editingStaff.value = null
  showStaffForm.value = true
}

function openEditStaff(member: StaffMember) {
  editingStaff.value = { ...member }
  showStaffForm.value = true
}

async function saveStaff(payload: StaffFormPayload) {
  const success = editingStaff.value?.id
    ? await staffStore.updateStaff(editingStaff.value.id, payload)
    : await staffStore.createStaff(payload)

  if (success) {
    showStaffForm.value = false
    editingStaff.value = null
  }
}

function confirmDeleteStaff(member: StaffMember) {
  Dialog.create({
    title: 'Remove staff member?',
    message: `This removes ${member.firstName} ${member.lastName} from the public staff page.`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void staffStore.deleteStaff(member.id)
  })
}
</script>

<template>
  <div>
    <div class="row items-center q-mb-lg q-gutter-sm">
      <div>
        <div class="dash-title">Welcome, Admin</div>
        <div class="text-caption text-grey-6">
          All changes are published instantly to the live site
        </div>
      </div>
      <q-space />
      <div class="text-caption text-grey-7">{{ authStore.user?.email }}</div>
    </div>

    <!-- Five sections, so the tab strip scrolls rather than wrapping on mobile. -->
    <q-tabs
      v-model="tab"
      class="q-mb-md dash-tabs"
      active-color="primary"
      indicator-color="primary"
      align="left"
      no-caps
      inline-label
      outside-arrows
      mobile-arrows
    >
      <q-tab name="events" label="Events" icon="event" />
      <q-tab name="announcements" label="Announcements" icon="campaign" />
      <q-tab name="staff" label="Staff" icon="groups" />
      <q-tab name="registrations" icon="how_to_reg">
        <span class="q-ml-sm">Registrations</span>
        <q-badge
          v-if="registrationsStore.registrations.length"
          color="primary"
          class="q-ml-sm"
        >
          {{ registrationsStore.registrations.length }}
        </q-badge>
      </q-tab>
      <q-tab name="messages" icon="mail">
        <span class="q-ml-sm">Messages</span>
        <q-badge
          v-if="messagesStore.newMessages.length"
          color="warning"
          text-color="dark"
          class="q-ml-sm"
        >
          {{ messagesStore.newMessages.length }}
        </q-badge>
      </q-tab>
      <q-tab name="access" icon="key">
        <span class="q-ml-sm">Access</span>
        <q-badge
          v-if="accessRequestsStore.requests.length"
          color="warning"
          text-color="dark"
          class="q-ml-sm"
        >
          {{ accessRequestsStore.requests.length }}
        </q-badge>
      </q-tab>
      <q-tab name="mentions" icon="alternate_email">
        <span class="q-ml-sm">Mentions</span>
        <q-badge
          v-if="mentionsStore.pending.length"
          color="warning"
          text-color="dark"
          class="q-ml-sm"
        >
          {{ mentionsStore.pending.length }}
        </q-badge>
      </q-tab>
      <q-tab name="feedback" icon="bug_report">
        <span class="q-ml-sm">Feedback</span>
        <q-badge
          v-if="ticketsStore.tickets.filter((t) => t.status !== 'completed').length"
          color="primary"
          class="q-ml-sm"
        >
          {{ ticketsStore.tickets.filter((t) => t.status !== 'completed').length }}
        </q-badge>
      </q-tab>
      <q-tab name="accounts" icon="vpn_key">
        <span class="q-ml-sm">Accounts</span>
        <q-icon
          v-if="!vaultStore.isUnlocked"
          name="lock"
          size="14px"
          class="q-ml-xs"
        />
      </q-tab>
      <q-tab name="settings" label="Settings" icon="settings" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated keep-alive>
      <!-- EVENTS -->
      <q-tab-panel name="events" class="q-px-none">
        <div class="row items-center q-mb-md q-gutter-sm">
          <div class="text-h6">Manage Events</div>
          <q-space />
          <q-btn
            outline
            no-caps
            icon="upload_file"
            label="Import spreadsheet"
            @click="importOpen = true"
          />
          <q-btn color="primary" unelevated no-caps icon="add" label="New Event" @click="openNewEvent" />
        </div>

        <!-- Only appears once something is ticked, so it never takes up space
             during ordinary single-event editing. -->
        <div v-if="selectedEventIds.length > 0" class="bulk-bar">
          <span class="bulk-bar__count">
            {{ selectedEventIds.length }} selected
          </span>
          <q-space />
          <q-btn
            dense
            flat
            no-caps
            icon="edit"
            label="Edit selected"
            @click="bulkEditOpen = true"
          />
          <q-btn
            dense
            flat
            no-caps
            color="negative"
            icon="delete"
            label="Delete selected"
            @click="confirmBulkDeleteEvents"
          />
          <q-btn
            dense
            flat
            no-caps
            label="Clear"
            @click="selectedEventIds = []"
          />
        </div>

        <q-card v-if="showEventForm" flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="text-subtitle1 q-mb-md">
              {{ editingEvent?.id ? 'Edit' : 'Create' }} Event
            </div>
            <EventForm
              :model-value="editingEvent || undefined"
              @save="saveEvent"
              @cancel="showEventForm = false; editingEvent = null"
            />
          </q-card-section>
        </q-card>

        <div v-if="eventsStore.loading" class="text-center q-pa-lg">
          <q-spinner color="primary" />
        </div>

        <div v-else-if="eventsStore.events.length === 0" class="empty-state">
          No events yet. Click "New Event" to get started.
        </div>

        <q-list v-else bordered separator class="rounded-borders">
          <q-item dense class="select-all-row">
            <q-item-section side>
              <q-checkbox
                :model-value="allEventsSelected"
                dense
                @update:model-value="toggleAllEvents"
              />
            </q-item-section>
            <q-item-section class="text-caption text-grey-6">
              Select all {{ eventsStore.events.length }}
            </q-item-section>
          </q-item>

          <q-item v-for="event in eventsStore.events" :key="event.id">
            <q-item-section side>
              <q-checkbox
                :model-value="selectedEventIds.includes(event.id)"
                dense
                :aria-label="`Select ${event.title}`"
                @update:model-value="(v: boolean) => toggleEvent(event.id, v)"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ event.title }}</q-item-label>
              <q-item-label caption>
                {{ event.date.toDate().toLocaleDateString() }} • {{ event.location }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="q-gutter-xs">
                <q-btn dense flat icon="edit" aria-label="Edit event" @click="openEditEvent(event)" />
                <q-btn
                  dense
                  flat
                  icon="delete"
                  color="negative"
                  aria-label="Delete event"
                  @click="confirmDeleteEvent(event.id)"
                />
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-tab-panel>

      <!-- ANNOUNCEMENTS -->
      <q-tab-panel name="announcements" class="q-px-none">
        <div class="row items-center q-mb-md">
          <div class="text-h6">Manage Announcements</div>
          <q-space />
          <q-btn
            color="primary"
            unelevated
            no-caps
            icon="add"
            label="New Announcement"
            @click="openNewAnnouncement"
          />
        </div>

        <q-card v-if="showAnnouncementForm" flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="text-subtitle1 q-mb-md">
              {{ editingAnnouncement?.id ? 'Edit' : 'Create' }} Announcement
            </div>
            <AnnouncementForm
              :model-value="editingAnnouncement || undefined"
              @save="saveAnnouncement"
              @cancel="showAnnouncementForm = false; editingAnnouncement = null"
            />
          </q-card-section>
        </q-card>

        <div v-if="announcementsStore.loading" class="text-center q-pa-lg">
          <q-spinner color="primary" />
        </div>

        <div v-else-if="announcementsStore.announcements.length === 0" class="empty-state">
          No announcements published yet.
        </div>

        <q-list v-else bordered separator class="rounded-borders">
          <q-item v-for="a in announcementsStore.announcements" :key="a.id">
            <q-item-section>
              <q-item-label class="text-weight-medium">
                {{ a.title }}
                <span v-if="a.pinned" class="pinned-badge q-ml-sm">Pinned</span>
              </q-item-label>
              <q-item-label caption class="ellipsis">{{ a.body }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="q-gutter-xs">
                <q-btn
                  dense
                  flat
                  icon="edit"
                  aria-label="Edit announcement"
                  @click="openEditAnnouncement(a)"
                />
                <q-btn
                  dense
                  flat
                  icon="delete"
                  color="negative"
                  aria-label="Delete announcement"
                  @click="confirmDeleteAnnouncement(a.id)"
                />
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-tab-panel>

      <!-- STAFF -->
      <q-tab-panel name="staff" class="q-px-none">
        <div class="row items-center q-mb-md">
          <div class="text-h6">Coaches &amp; Staff</div>
          <q-space />
          <q-btn
            color="primary"
            unelevated
            no-caps
            icon="add"
            label="Add Staff Member"
            @click="openNewStaff"
          />
        </div>

        <q-card v-if="showStaffForm" flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="text-subtitle1 q-mb-md">
              {{ editingStaff?.id ? 'Edit' : 'Add' }} Staff Member
            </div>
            <StaffForm
              :model-value="editingStaff || undefined"
              @save="saveStaff"
              @cancel="showStaffForm = false; editingStaff = null"
            />
          </q-card-section>
        </q-card>

        <div v-if="staffStore.loading" class="text-center q-pa-lg">
          <q-spinner color="primary" />
        </div>

        <div v-else-if="staffStore.staff.length === 0" class="empty-state">
          No staff members yet. Add coaches and volunteers to fill the public staff page.
        </div>

        <q-list v-else bordered separator class="rounded-borders">
          <q-item v-for="member in staffStore.staff" :key="member.id">
            <q-item-section avatar>
              <q-avatar color="primary" text-color="white" size="38px">
                {{ member.firstName.charAt(0) }}{{ member.lastName.charAt(0) }}
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">
                {{ member.firstName }} {{ member.lastName }}
              </q-item-label>
              <q-item-label caption>
                {{ member.role }} · order {{ member.order }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="q-gutter-xs">
                <q-btn
                  dense
                  flat
                  icon="edit"
                  aria-label="Edit staff member"
                  @click="openEditStaff(member)"
                />
                <q-btn
                  dense
                  flat
                  icon="delete"
                  color="negative"
                  aria-label="Remove staff member"
                  @click="confirmDeleteStaff(member)"
                />
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-tab-panel>

      <!-- REGISTRATIONS -->
      <q-tab-panel name="registrations" class="q-px-none">
        <RegistrationsInbox />
      </q-tab-panel>

      <!-- CONTACT MESSAGES -->
      <q-tab-panel name="messages" class="q-px-none">
        <MessagesInbox />
      </q-tab-panel>

      <!-- ACCESS REQUESTS -->
      <q-tab-panel name="access" class="q-px-none">
        <AccessRequestsInbox />
      </q-tab-panel>

      <!-- X MENTIONS -->
      <q-tab-panel name="mentions" class="q-px-none">
        <MentionsQueue />
      </q-tab-panel>

      <!-- FEEDBACK -->
      <q-tab-panel name="feedback" class="q-px-none">
        <FeedbackBoard />
      </q-tab-panel>

      <!-- ACCOUNT VAULT -->
      <q-tab-panel name="accounts" class="q-px-none">
        <AccountsVault />
      </q-tab-panel>

      <!-- SETTINGS -->
      <q-tab-panel name="settings" class="q-px-none">
        <div class="text-h6 q-mb-md">Organization Settings</div>
        <SettingsForm />
      </q-tab-panel>
    </q-tab-panels>

    <EventImportDialog v-model="importOpen" />
    <EventBulkEditDialog
      v-model="bulkEditOpen"
      :ids="selectedEventIds"
      @done="selectedEventIds = []"
    />
  </div>
</template>

<style scoped>
.bulk-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  background: var(--grey-100, #f3f4f6);
  border: 1px solid var(--grey-200, #e5e7eb);
  border-radius: 8px;
  padding: 6px 10px;
  margin-bottom: 10px;
}

.bulk-bar__count {
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--navy-800);
}

.select-all-row {
  background: var(--grey-050, #fafafa);
}

.dash-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.5rem;
  text-transform: uppercase;
  color: var(--navy-800);
  line-height: 1.1;
}

.dash-tabs {
  border-bottom: 1px solid var(--grey-200);
}
</style>
