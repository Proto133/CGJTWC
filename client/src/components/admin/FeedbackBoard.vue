<script setup lang="ts">
import { ref, computed } from 'vue'
import { Dialog, date, copyToClipboard, Notify } from 'quasar'
import { useTicketsStore } from 'stores/tickets'
import { useAuthStore } from 'stores/auth'
import TicketDialog from 'components/admin/TicketDialog.vue'
import type { Ticket, TicketStatus } from 'src/types'

const tickets = useTicketsStore()
const auth = useAuthStore()

const statusFilter = ref<TicketStatus | 'all'>('all')
const newTicketOpen = ref(false)
const drafts = ref<Record<string, string>>({})

const statusMeta: Record<TicketStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'primary' },
  'in-progress': { label: 'In progress', color: 'warning' },
  completed: { label: 'Completed', color: 'positive' },
}

const priorityColors: Record<string, string> = {
  low: 'grey-6',
  normal: 'grey-7',
  high: 'negative',
}

const counts = computed(() => ({
  all: tickets.tickets.length,
  open: tickets.tickets.filter((t) => t.status === 'open').length,
  'in-progress': tickets.tickets.filter((t) => t.status === 'in-progress').length,
  completed: tickets.tickets.filter((t) => t.status === 'completed').length,
}))

const filtered = computed(() =>
  statusFilter.value === 'all'
    ? tickets.tickets
    : tickets.tickets.filter((t) => t.status === statusFilter.value))

function when(ts?: { toDate: () => Date }) {
  return ts ? date.formatDate(ts.toDate(), 'MMM D, YYYY h:mm A') : 'Just now'
}

/** Everything before the @, so threads read like a conversation. */
function displayName(email: string) {
  return email ? email.split('@')[0] : 'unknown'
}

function isMine(uid: string) {
  return uid === auth.user?.uid
}

function onExpand(ticket: Ticket, expanded: boolean) {
  if (expanded) tickets.subscribeComments(ticket.id)
  else tickets.unsubscribeComments(ticket.id)
}

async function postComment(ticketId: string) {
  const body = (drafts.value[ticketId] ?? '').trim()
  if (!body) return
  const ok = await tickets.addComment(ticketId, body)
  if (ok) drafts.value = { ...drafts.value, [ticketId]: '' }
}

/**
 * A ticket as plain text, for pasting somewhere else.
 *
 * Front-loads type, title and the page it was reported from, since that is the
 * context anyone picking the ticket up needs first.
 */
function ticketAsText(ticket: Ticket): string {
  const lines = [
    `[${ticket.type.toUpperCase()}] ${ticket.title}`,
    `Priority: ${ticket.priority} · Status: ${ticket.status}`,
  ]

  if (ticket.pageUrl) lines.push(`Reported from: ${ticket.pageUrl}`)
  lines.push(`Filed by ${displayName(ticket.createdByEmail)} on ${when(ticket.createdAt)}`)
  if (ticket.description) lines.push('', ticket.description)

  return lines.join('\n')
}

async function copyTicket(ticket: Ticket) {
  try {
    await copyToClipboard(ticketAsText(ticket))
    Notify.create({ type: 'info', message: 'Ticket copied to clipboard' })
  } catch {
    // Clipboard access needs user activation and a secure context; if the
    // browser refuses, say so rather than leaving them to paste nothing.
    Notify.create({ type: 'negative', message: 'Could not access the clipboard' })
  }
}

function confirmDeleteTicket(ticket: Ticket) {
  Dialog.create({
    title: 'Delete ticket?',
    message: `"${ticket.title}" and its comments will be removed.`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void tickets.removeTicket(ticket.id)
  })
}
</script>

<template>
  <div>
    <div class="row items-center q-mb-md q-gutter-sm">
      <div class="text-h6">Bugs &amp; Requests</div>
      <q-space />
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="add"
        label="New"
        @click="newTicketOpen = true"
      />
    </div>

    <!-- Status is owner-only, and nobody is an owner until a role is set, so
         say so plainly rather than letting the controls look broken. -->
    <div v-if="!auth.isOwner" class="info-banner">
      <q-icon name="info" size="16px" class="q-mr-xs" />
      You can file tickets and comment. Changing status is limited to the owner
      — add <code>role: "owner"</code> to your document in the
      <code>admins</code> collection to enable it.
    </div>

    <q-btn-toggle
      v-model="statusFilter"
      no-caps
      unelevated
      dense
      toggle-color="primary"
      text-color="primary"
      color="white"
      class="status-toggle q-mb-md"
      :options="[
        { label: `All (${counts.all})`, value: 'all' },
        { label: `Open (${counts.open})`, value: 'open' },
        { label: `In progress (${counts['in-progress']})`, value: 'in-progress' },
        { label: `Completed (${counts.completed})`, value: 'completed' },
      ]"
    />

    <div v-if="tickets.loading" class="text-center q-pa-lg">
      <q-spinner color="primary" />
    </div>

    <div v-else-if="filtered.length === 0" class="empty-state">
      Nothing here yet. Use the button above, or the floating button on any page,
      to report a bug or request a feature.
    </div>

    <q-list v-else bordered separator class="rounded-borders">
      <q-expansion-item
        v-for="ticket in filtered"
        :key="ticket.id"
        @update:model-value="(v: boolean) => onExpand(ticket, v)"
      >
        <template #header>
          <q-item-section avatar>
            <q-icon
              :name="ticket.type === 'bug' ? 'bug_report' : 'lightbulb'"
              :color="ticket.type === 'bug' ? 'negative' : 'primary'"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">{{ ticket.title }}</q-item-label>
            <q-item-label caption>
              {{ displayName(ticket.createdByEmail) }} · {{ when(ticket.createdAt) }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="row q-gutter-xs items-center">
              <!-- click.stop, otherwise copying also toggles the panel. -->
              <q-btn
                dense
                flat
                round
                size="sm"
                icon="content_copy"
                aria-label="Copy ticket to clipboard"
                @click.stop="copyTicket(ticket)"
              >
                <q-tooltip>Copy as text</q-tooltip>
              </q-btn>
              <q-badge
                v-if="ticket.priority === 'high'"
                :color="priorityColors[ticket.priority]"
                class="meta-badge"
              >
                High
              </q-badge>
              <q-badge :color="statusMeta[ticket.status].color" class="meta-badge">
                {{ statusMeta[ticket.status].label }}
              </q-badge>
            </div>
          </q-item-section>
        </template>

        <div class="q-pa-md ticket-body">
          <p v-if="ticket.description" class="ticket-desc">{{ ticket.description }}</p>

          <div v-if="ticket.pageUrl" class="ticket-meta">
            <span class="ticket-meta__key">Reported from</span>
            <code>{{ ticket.pageUrl }}</code>
          </div>

          <!-- Owner-only controls -->
          <div v-if="auth.isOwner" class="row items-center q-gutter-sm q-mt-md">
            <q-btn-toggle
              :model-value="ticket.status"
              no-caps
              unelevated
              dense
              toggle-color="primary"
              text-color="primary"
              color="white"
              class="status-toggle"
              :disable="tickets.working === ticket.id"
              :options="[
                { label: 'Open', value: 'open' },
                { label: 'In progress', value: 'in-progress' },
                { label: 'Completed', value: 'completed' },
              ]"
              @update:model-value="(v: TicketStatus) => tickets.setStatus(ticket.id, v)"
            />
            <q-space />
            <q-btn
              dense
              flat
              no-caps
              icon="delete"
              label="Delete"
              color="negative"
              @click="confirmDeleteTicket(ticket)"
            />
          </div>

          <!-- Conversation -->
          <div class="thread">
            <div class="thread__label">Discussion</div>

            <div
              v-for="comment in tickets.comments[ticket.id] ?? []"
              :key="comment.id"
              class="bubble"
              :class="{ 'bubble--mine': isMine(comment.authorUid) }"
            >
              <div class="bubble__meta">
                {{ isMine(comment.authorUid) ? 'You' : displayName(comment.authorEmail) }}
                · {{ when(comment.createdAt) }}
              </div>
              <div class="bubble__body">{{ comment.body }}</div>
              <q-btn
                v-if="isMine(comment.authorUid) || auth.isOwner"
                dense
                flat
                round
                size="xs"
                icon="close"
                class="bubble__delete"
                aria-label="Delete comment"
                @click="tickets.removeComment(ticket.id, comment.id)"
              />
            </div>

            <div
              v-if="(tickets.comments[ticket.id] ?? []).length === 0"
              class="thread__empty"
            >
              No comments yet.
            </div>

            <div class="row q-gutter-sm items-end q-mt-sm">
              <q-input
                :model-value="drafts[ticket.id] ?? ''"
                class="col"
                dense
                outlined
                autogrow
                placeholder="Write a reply…"
                @update:model-value="(v) => (drafts[ticket.id] = String(v ?? ''))"
                @keydown.enter.exact.prevent="postComment(ticket.id)"
              />
              <q-btn
                unelevated
                no-caps
                color="primary"
                icon="send"
                :disable="!(drafts[ticket.id] ?? '').trim()"
                aria-label="Post comment"
                @click="postComment(ticket.id)"
              />
            </div>
          </div>
        </div>
      </q-expansion-item>
    </q-list>

    <TicketDialog v-model="newTicketOpen" />
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

.status-toggle {
  border: 1px solid var(--grey-200);
  border-radius: 999px;
  overflow: hidden;
}

.meta-badge {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.66rem;
  font-weight: 600;
}

.ticket-body {
  background: var(--grey-050);
}

.ticket-desc {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--grey-600);
  line-height: 1.6;
}

.ticket-meta {
  margin-top: 10px;
  font-size: 0.85rem;
}

.ticket-meta__key {
  display: block;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--grey-400);
}

.ticket-meta code,
.info-banner code {
  background: #fff;
  border: 1px solid var(--grey-200);
  border-radius: 4px;
  padding: 1px 5px;
  overflow-wrap: anywhere;
}

.thread {
  margin-top: 18px;
  border-top: 1px solid var(--grey-200);
  padding-top: 12px;
}

.thread__label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.74rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--grey-400);
  margin-bottom: 8px;
}

.thread__empty {
  font-size: 0.85rem;
  color: var(--grey-400);
}

.bubble {
  position: relative;
  background: #fff;
  border: 1px solid var(--grey-200);
  border-radius: var(--radius-sm);
  padding: 8px 30px 8px 10px;
  margin-bottom: 8px;
  max-width: 90%;
}

/* Your own messages sit right and tinted, so a thread is scannable at a glance. */
.bubble--mine {
  margin-left: auto;
  background: var(--grey-100);
  border-color: var(--grey-300);
}

.bubble__meta {
  font-size: 0.72rem;
  color: var(--grey-400);
  margin-bottom: 2px;
}

.bubble__body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.bubble__delete {
  position: absolute;
  top: 4px;
  right: 4px;
  color: var(--grey-400);
}
</style>
