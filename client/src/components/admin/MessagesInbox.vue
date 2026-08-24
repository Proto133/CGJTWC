<script setup lang="ts">
import { ref, computed } from 'vue'
import { Dialog } from 'quasar'
import { useContactMessagesStore } from 'stores/contactMessages'
import { useAuthStore } from 'stores/auth'
import type { ContactMessage, ContactMessageStatus } from 'src/types'

const store = useContactMessagesStore()
const auth = useAuthStore()

type Filter = ContactMessageStatus | 'all'
const filter = ref<Filter>('new')

const counts = computed(() => ({
  new: store.messages.filter((m) => m.status === 'new').length,
  'in-progress': store.messages.filter((m) => m.status === 'in-progress').length,
  resolved: store.messages.filter((m) => m.status === 'resolved').length,
}))

const visible = computed(() =>
  filter.value === 'all'
    ? store.messages
    : store.messages.filter((m) => m.status === filter.value),
)

const STATUS_COLOURS: Record<ContactMessageStatus, string> = {
  new: 'warning',
  'in-progress': 'primary',
  resolved: 'positive',
}

function formatDate(message: ContactMessage): string {
  // serverTimestamp() is null on the local echo until the server confirms.
  if (!message.createdAt) return 'Just now'
  return message.createdAt.toDate().toLocaleString()
}

/** Prefilled reply, quoting the original so the sender has context. */
function replyHref(message: ContactMessage): string {
  const subject = encodeURIComponent('Re: your message to Trojans Wrestling Club')
  const body = encodeURIComponent(
    `\n\n---\nYou wrote on ${formatDate(message)}:\n${message.message}`,
  )
  return `mailto:${message.email}?subject=${subject}&body=${body}`
}

async function setStatus(message: ContactMessage, status: ContactMessageStatus) {
  await store.update(message.id, { status })
}

/** Free text, so anyone can put their own name or a volunteer's. */
async function saveAssignee(message: ContactMessage, value: string) {
  if (value === (message.assignedTo ?? '')) return
  await store.update(message.id, { assignedTo: value })
}

async function saveNotes(message: ContactMessage, value: string) {
  if (value === (message.adminNotes ?? '')) return
  await store.update(message.id, { adminNotes: value })
}

function takeIt(message: ContactMessage) {
  void store.update(message.id, {
    assignedTo: auth.user?.email ?? '',
    status: message.status === 'new' ? 'in-progress' : message.status,
  })
}

function confirmDelete(message: ContactMessage) {
  Dialog.create({
    title: 'Delete this message?',
    message: `From ${message.name} (${message.email}). This cannot be undone.`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void store.remove(message.id)
  })
}
</script>

<template>
  <div>
    <div class="row items-center q-mb-md">
      <div>
        <div class="text-h6">Contact Messages</div>
        <div class="text-caption text-grey-6">
          Sent from the public contact page. Every admin can see and handle these.
        </div>
      </div>
    </div>

    <q-btn-toggle
      v-model="filter"
      class="q-mb-md"
      no-caps
      unelevated
      toggle-color="primary"
      :options="[
        { label: `New (${counts.new})`, value: 'new' },
        { label: `In progress (${counts['in-progress']})`, value: 'in-progress' },
        { label: `Resolved (${counts.resolved})`, value: 'resolved' },
        { label: `All (${store.messages.length})`, value: 'all' },
      ]"
    />

    <div v-if="store.loading" class="text-center q-pa-lg">
      <q-spinner color="primary" />
    </div>

    <div v-else-if="visible.length === 0" class="empty-state">
      Nothing here. Messages sent from the contact page appear immediately.
    </div>

    <div v-else class="q-gutter-md">
      <q-card v-for="message in visible" :key="message.id" flat bordered>
        <q-card-section class="q-pb-none">
          <div class="row items-start q-gutter-sm">
            <div class="col">
              <div class="text-weight-medium">
                {{ message.name }}
                <q-badge
                  :color="STATUS_COLOURS[message.status]"
                  :text-color="message.status === 'new' ? 'dark' : 'white'"
                  class="q-ml-sm"
                >
                  {{ message.status }}
                </q-badge>
              </div>
              <div class="text-caption text-grey-6">
                <a :href="`mailto:${message.email}`">{{ message.email }}</a>
                · {{ formatDate(message) }}
              </div>
            </div>
            <q-btn
              dense
              flat
              icon="delete"
              color="negative"
              aria-label="Delete message"
              @click="confirmDelete(message)"
            />
          </div>
        </q-card-section>

        <q-card-section>
          <p class="msg__body">{{ message.message }}</p>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-5">
              <!-- Debounced: without it every keystroke would be a Firestore
                   write and a listener round trip. -->
              <q-input
                :model-value="message.assignedTo ?? ''"
                label="Handled by"
                dense
                outlined
                maxlength="120"
                placeholder="Name or email"
                debounce="800"
                @update:model-value="(v) => saveAssignee(message, String(v ?? ''))"
              >
                <template #append>
                  <q-btn
                    dense
                    flat
                    no-caps
                    size="sm"
                    label="Me"
                    @click="takeIt(message)"
                  />
                </template>
              </q-input>
            </div>
            <div class="col-12 col-sm-7">
              <q-input
                :model-value="message.adminNotes ?? ''"
                label="Internal notes"
                dense
                outlined
                autogrow
                maxlength="4000"
                debounce="800"
                @update:model-value="(v) => saveNotes(message, String(v ?? ''))"
              />
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="left" class="q-px-md q-pb-md">
          <q-btn
            :href="replyHref(message)"
            unelevated
            no-caps
            color="primary"
            icon="reply"
            label="Reply by email"
          />
          <q-space />
          <q-btn
            v-if="message.status !== 'in-progress'"
            flat
            no-caps
            label="In progress"
            @click="setStatus(message, 'in-progress')"
          />
          <q-btn
            v-if="message.status !== 'resolved'"
            flat
            no-caps
            color="positive"
            label="Resolved"
            @click="setStatus(message, 'resolved')"
          />
          <q-btn
            v-if="message.status === 'resolved'"
            flat
            no-caps
            label="Reopen"
            @click="setStatus(message, 'new')"
          />
        </q-card-actions>
      </q-card>
    </div>
  </div>
</template>

<style scoped>
.msg__body {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.55;
}
</style>
