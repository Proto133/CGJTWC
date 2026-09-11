<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Dialog, date } from 'quasar'
import { useAdminThreadsStore } from 'stores/adminThreads'
import { useAuthStore } from 'stores/auth'
import type { AdminThread, AdminThreadMessage } from 'src/types'

/**
 * Internal discussion, organised into topics.
 *
 * Deliberately a board rather than a chat: nothing can notify anybody without
 * Cloud Functions, and a threaded board is an asynchronous medium by nature
 * whereas a silent chat quietly loses messages.
 */

const store = useAdminThreadsStore()
const auth = useAuthStore()

const showNew = ref(false)
const newTitle = ref('')
const newBody = ref('')
const reply = ref('')

onMounted(() => store.subscribe())
onBeforeUnmount(() => store.unsubscribeFromThreads())

const openThread = computed<AdminThread | null>(() =>
  store.threads.find((t) => t.id === store.openThreadId) ?? null)

// ---------------------------------------------------------------------------
// Unread markers
// ---------------------------------------------------------------------------

/**
 * Last-read stamps, per thread, in local storage.
 *
 * Per-device rather than per-account: the same coach on a phone and a laptop
 * gets two sets of markers. Proper per-user state would mean writing to their
 * admin record on every read, which is not worth it until somebody asks.
 */
const SEEN_KEY = 'admin-threads-seen-v1'
const seen = ref<Record<string, number>>({})

function loadSeen() {
  try {
    seen.value = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, number>
  } catch {
    seen.value = {}
  }
}

function markSeen(threadId: string) {
  seen.value = { ...seen.value, [threadId]: Date.now() }
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen.value))
  } catch {
    // Nothing to do; markers simply will not persist on this device.
  }
}

onMounted(loadSeen)

function isUnread(thread: AdminThread): boolean {
  const last = thread.lastMessageAt?.toMillis() ?? thread.createdAt?.toMillis() ?? 0
  return last > (seen.value[thread.id] ?? 0)
}

/** Shown on the dashboard tab, so activity is visible without opening this. */
const unreadCount = computed(() => store.threads.filter(isUnread).length)
defineExpose({ unreadCount })

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const canStart = computed(() =>
  newTitle.value.trim() !== '' && newBody.value.trim() !== '')

async function startThread() {
  if (!canStart.value) return
  const id = await store.createThread(newTitle.value, newBody.value)
  if (typeof id === 'string') {
    newTitle.value = ''
    newBody.value = ''
    showNew.value = false
    select(id)
  }
}

function select(threadId: string) {
  store.openThread(threadId)
  markSeen(threadId)
}

async function send() {
  const threadId = store.openThreadId
  if (!threadId || reply.value.trim() === '') return
  const ok = await store.postMessage(threadId, reply.value)
  if (ok) {
    reply.value = ''
    markSeen(threadId)
  }
}

function confirmDeleteThread(thread: AdminThread) {
  Dialog.create({
    title: 'Delete this topic?',
    message:
      `"${thread.title}" and all ${thread.messageCount} `
      + `message${thread.messageCount === 1 ? '' : 's'} will be removed. `
      + 'This cannot be undone.',
    cancel: true,
    persistent: true,
    ok: { label: 'Delete', color: 'negative', unelevated: true, noCaps: true },
  }).onOk(() => {
    void store.deleteThread(thread.id)
  })
}

function canDelete(message: AdminThreadMessage): boolean {
  return auth.isOwner || message.authorUid === auth.user?.uid
}

function confirmDeleteMessage(message: AdminThreadMessage) {
  const threadId = store.openThreadId
  if (!threadId) return
  Dialog.create({
    title: 'Delete this reply?',
    message: 'It will be removed for everyone.',
    cancel: true,
    ok: { label: 'Delete', color: 'negative', unelevated: true, noCaps: true },
  }).onOk(() => {
    void store.deleteMessage(threadId, message.id)
  })
}

function when(stamp: { toDate: () => Date } | undefined): string {
  if (!stamp) return ''
  return date.formatDate(stamp.toDate(), 'MMM D, h:mm A')
}

/** "pete@example.com" reads better as "pete" in a list of four people. */
function shortName(email: string): string {
  return email.split('@')[0] ?? email
}
</script>

<template>
  <div>
    <div class="row items-center q-mb-sm q-gutter-sm">
      <div class="text-h6">Discussion</div>
      <q-space />
      <q-btn
        color="primary"
        unelevated
        no-caps
        icon="add"
        label="New topic"
        @click="showNew = true"
      />
    </div>

    <div class="settings-note settings-note--inline q-mb-md">
      Admins only. Nobody is emailed when a topic gets a reply, so this is a
      place to work things out and keep a record, not to raise something urgent.
    </div>

    <q-card v-if="showNew" flat bordered class="q-mb-md">
      <q-card-section class="q-gutter-sm">
        <q-input
          v-model="newTitle"
          label="Topic *"
          placeholder="Mat rental for the December home meet"
          outlined
          dense
          maxlength="140"
        />
        <q-input
          v-model="newBody"
          type="textarea"
          label="First message *"
          outlined
          dense
          autogrow
        />
        <div class="row q-gutter-sm justify-end">
          <q-btn flat no-caps label="Cancel" @click="showNew = false" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Start topic"
            :disable="!canStart"
            :loading="store.working"
            @click="startThread"
          />
        </div>
      </q-card-section>
    </q-card>

    <div class="threads-layout">
      <!-- List -->
      <div class="threads-list">
        <div v-if="store.loading" class="text-center q-pa-md">
          <q-spinner color="primary" />
        </div>

        <div v-else-if="store.ordered.length === 0" class="empty-state">
          No topics yet.
        </div>

        <q-list v-else bordered separator class="rounded-borders">
          <q-item
            v-for="thread in store.ordered"
            :key="thread.id"
            v-ripple
            clickable
            :active="thread.id === store.openThreadId"
            active-class="thread-item--active"
            @click="select(thread.id)"
          >
            <q-item-section>
              <q-item-label class="row items-center q-gutter-xs">
                <q-icon v-if="thread.pinned" name="push_pin" size="14px" color="primary" />
                <span :class="{ 'text-weight-bold': isUnread(thread) }">
                  {{ thread.title }}
                </span>
                <q-badge v-if="isUnread(thread)" color="primary" rounded />
              </q-item-label>
              <q-item-label caption>
                {{ thread.messageCount }}
                message{{ thread.messageCount === 1 ? '' : 's' }}
                <template v-if="thread.lastMessageAt">
                  · {{ when(thread.lastMessageAt) }}
                </template>
                <template v-if="thread.resolved"> · resolved</template>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- Detail -->
      <div class="thread-detail">
        <div v-if="!openThread" class="empty-state">
          Pick a topic to read it.
        </div>

        <q-card v-else flat bordered>
          <q-card-section class="thread-head">
            <div class="text-subtitle1">{{ openThread.title }}</div>
            <div class="text-caption text-grey-6">
              Started by {{ shortName(openThread.createdByEmail) }}
              · {{ when(openThread.createdAt) }}
            </div>
            <div class="row q-gutter-xs q-mt-sm">
              <q-btn
                dense
                flat
                no-caps
                size="sm"
                :icon="openThread.pinned ? 'push_pin' : 'push_pin'"
                :label="openThread.pinned ? 'Unpin' : 'Pin'"
                @click="store.setFlags(openThread.id, { pinned: !openThread.pinned })"
              />
              <q-btn
                dense
                flat
                no-caps
                size="sm"
                :icon="openThread.resolved ? 'replay' : 'check'"
                :label="openThread.resolved ? 'Reopen' : 'Mark resolved'"
                @click="store.setFlags(openThread.id, { resolved: !openThread.resolved })"
              />
              <q-space />
              <q-btn
                dense
                flat
                no-caps
                size="sm"
                icon="delete"
                color="negative"
                label="Delete topic"
                @click="confirmDeleteThread(openThread)"
              />
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <div v-if="store.messagesLoading" class="text-center q-pa-md">
              <q-spinner color="primary" />
            </div>

            <ul v-else class="messages">
              <li v-for="message in store.messages" :key="message.id" class="message">
                <div class="message__meta">
                  <span class="message__author">{{ shortName(message.authorEmail) }}</span>
                  <span class="message__time">{{ when(message.createdAt) }}</span>
                  <q-space />
                  <q-btn
                    v-if="canDelete(message)"
                    dense
                    flat
                    round
                    size="sm"
                    icon="close"
                    color="grey-6"
                    aria-label="Delete reply"
                    @click="confirmDeleteMessage(message)"
                  />
                </div>
                <p class="message__body">{{ message.body }}</p>
              </li>
            </ul>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <q-input
              v-model="reply"
              type="textarea"
              label="Reply"
              outlined
              dense
              autogrow
              @keydown.ctrl.enter="send"
            />
            <div class="row justify-end q-mt-sm">
              <q-btn
                unelevated
                no-caps
                color="primary"
                label="Post reply"
                :disable="reply.trim() === ''"
                :loading="store.working"
                @click="send"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.threads-layout {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
}

/* Side by side once there is room; stacked on a phone. */
@media (min-width: 1024px) {
  .threads-layout {
    grid-template-columns: minmax(260px, 340px) 1fr;
    align-items: start;
  }
}

.thread-item--active {
  background: var(--grey-100);
}

.thread-head {
  padding-bottom: 8px;
}

.messages {
  list-style: none;
  margin: 0;
  padding: 0;
}

.message {
  padding: 10px 0;
  border-top: 1px solid var(--grey-200);
}

.message:first-child {
  border-top: none;
  padding-top: 0;
}

.message__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--grey-500);
}

.message__author {
  font-weight: 600;
  color: var(--navy-800);
}

.message__body {
  margin: 4px 0 0;
  font-size: 0.94rem;
  line-height: 1.55;
  /* Replies are typed by hand and arrive with real newlines. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
