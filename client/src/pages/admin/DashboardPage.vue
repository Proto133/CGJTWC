<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useEventsStore } from 'stores/events'
import { useAnnouncementsStore } from 'stores/announcements'
import { useAuthStore } from 'stores/auth'
import EventForm from 'components/admin/EventForm.vue'
import AnnouncementForm from 'components/admin/AnnouncementForm.vue'
import type {
  Event,
  Announcement,
  EventFormPayload,
  AnnouncementFormPayload,
} from 'src/types'
import { Dialog } from 'quasar'

const tab = ref<'events' | 'announcements'>('events')

const eventsStore = useEventsStore()
const announcementsStore = useAnnouncementsStore()
const authStore = useAuthStore()

// Form state
const showEventForm = ref(false)
const editingEvent = ref<Partial<Event> | null>(null)
const showAnnouncementForm = ref(false)
const editingAnnouncement = ref<Partial<Announcement> | null>(null)

onMounted(() => {
  eventsStore.subscribe()
  announcementsStore.subscribe()
})

onUnmounted(() => {
  eventsStore.unsubscribeFromEvents()
  announcementsStore.unsubscribeFromAnnouncements()
})

function openNewEvent() {
  editingEvent.value = null
  showEventForm.value = true
}

function openEditEvent(event: Event) {
  editingEvent.value = { ...event }
  showEventForm.value = true
}

async function saveEvent(payload: EventFormPayload) {
  let success = false
  if (editingEvent.value?.id) {
    success = await eventsStore.updateEvent(editingEvent.value.id, payload)
  } else {
    success = await eventsStore.createEvent(payload)
  }
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

// Announcements
function openNewAnnouncement() {
  editingAnnouncement.value = null
  showAnnouncementForm.value = true
}

function openEditAnnouncement(a: Announcement) {
  editingAnnouncement.value = { ...a }
  showAnnouncementForm.value = true
}

async function saveAnnouncement(payload: AnnouncementFormPayload) {
  let success = false
  if (editingAnnouncement.value?.id) {
    success = await announcementsStore.updateAnnouncement(editingAnnouncement.value.id, payload)
  } else {
    success = await announcementsStore.createAnnouncement(payload)
  }
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
</script>

<template>
  <div>
    <div class="row items-center q-mb-lg">
      <div>
        <div class="text-h5 text-primary">Welcome, Admin</div>
        <div class="text-caption text-grey-6">All changes are published instantly to the live site</div>
      </div>
      <q-space />
      <div class="text-caption">Logged in as {{ authStore.user?.email }}</div>
    </div>

    <q-tabs v-model="tab" class="q-mb-md" active-color="primary" indicator-color="primary">
      <q-tab name="events" label="Events" icon="event" />
      <q-tab name="announcements" label="Announcements" icon="campaign" />
    </q-tabs>

    <!-- EVENTS TAB -->
    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="events">
        <div class="row items-center q-mb-md">
          <div class="text-h6">Manage Events</div>
          <q-space />
          <q-btn color="primary" icon="add" label="New Event" @click="openNewEvent" />
        </div>

        <q-card v-if="showEventForm" flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="text-subtitle1 q-mb-md">{{ editingEvent?.id ? 'Edit' : 'Create' }} Event</div>
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

        <q-list v-else bordered separator>
          <q-item v-for="event in eventsStore.events" :key="event.id">
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ event.title }}</q-item-label>
              <q-item-label caption>
                {{ event.date.toDate().toLocaleDateString() }} • {{ event.location }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="q-gutter-xs">
                <q-btn dense flat icon="edit" @click="openEditEvent(event)" />
                <q-btn dense flat icon="delete" color="negative" @click="confirmDeleteEvent(event.id)" />
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-if="eventsStore.events.length === 0" class="text-grey-6 q-pa-md">
          No events yet. Click "New Event" to get started.
        </div>
      </q-tab-panel>

      <!-- ANNOUNCEMENTS TAB -->
      <q-tab-panel name="announcements">
        <div class="row items-center q-mb-md">
          <div class="text-h6">Manage Announcements</div>
          <q-space />
          <q-btn color="primary" icon="add" label="New Announcement" @click="openNewAnnouncement" />
        </div>

        <q-card v-if="showAnnouncementForm" flat bordered class="q-mb-lg">
          <q-card-section>
            <div class="text-subtitle1 q-mb-md">{{ editingAnnouncement?.id ? 'Edit' : 'Create' }} Announcement</div>
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

        <q-list v-else bordered separator>
          <q-item v-for="a in announcementsStore.announcements" :key="a.id">
            <q-item-section>
              <q-item-label class="text-weight-medium">
                {{ a.title }}
                <span v-if="a.pinned" class="pinned-badge q-ml-sm">Pinned</span>
              </q-item-label>
              <q-item-label caption class="ellipsis" style="max-width: 420px">
                {{ a.body }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="q-gutter-xs">
                <q-btn dense flat icon="edit" @click="openEditAnnouncement(a)" />
                <q-btn dense flat icon="delete" color="negative" @click="confirmDeleteAnnouncement(a.id)" />
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-if="announcementsStore.announcements.length === 0" class="text-grey-6 q-pa-md">
          No announcements published yet.
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<style scoped>
</style>
