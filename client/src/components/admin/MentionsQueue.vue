<script setup lang="ts">
import { ref, computed } from 'vue'
import { Dialog } from 'quasar'
import { useXMentionsStore } from 'stores/xMentions'
import { tokenizeXText, formatXDate } from 'src/utils/xText'
import type { XMention, XMentionStatus } from 'src/types'

const store = useXMentionsStore()

type Filter = 'pending' | 'approved' | 'rejected'
const filter = ref<Filter>('pending')

const approvedList = computed(() => store.queue.filter((m) => m.status === 'approved'))
const rejectedList = computed(() => store.queue.filter((m) => m.status === 'rejected'))

const visible = computed<XMention[]>(() => {
  if (filter.value === 'approved') return approvedList.value
  if (filter.value === 'rejected') return rejectedList.value
  return store.pending
})

const emptyMessage = computed(() => {
  if (filter.value === 'pending') {
    return 'Nothing waiting for review. New mentions appear here after the scheduled fetch runs.'
  }
  if (filter.value === 'approved') return 'No mentions have been approved yet.'
  return 'No mentions have been rejected.'
})

async function decide(mention: XMention, status: XMentionStatus) {
  await store.setStatus(mention.id, status)
}

function confirmRemove(mention: XMention) {
  Dialog.create({
    title: 'Delete this mention?',
    message:
      'It is removed from the queue entirely. If X still returns it on a later ' +
      'fetch it will come back as pending.',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void store.remove(mention.id)
  })
}
</script>

<template>
  <div>
    <div class="row items-center q-mb-md">
      <div>
        <div class="text-h6">Mentions of the club</div>
        <div class="text-caption text-grey-6">
          Posts by other accounts. Nothing here is visible on the public site until
          you approve it.
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
        { label: `Pending (${store.pending.length})`, value: 'pending' },
        { label: `Approved (${approvedList.length})`, value: 'approved' },
        { label: `Rejected (${rejectedList.length})`, value: 'rejected' },
      ]"
    />

    <div v-if="store.loading" class="text-center q-pa-lg">
      <q-spinner color="primary" />
    </div>

    <div v-else-if="visible.length === 0" class="empty-state">
      {{ emptyMessage }}
    </div>

    <q-list v-else bordered separator class="rounded-borders">
      <q-item v-for="mention in visible" :key="mention.id" class="q-py-md">
        <q-item-section avatar top>
          <q-avatar size="40px">
            <img v-if="mention.author.avatar" :src="mention.author.avatar" alt="" />
            <q-icon v-else name="person" />
          </q-avatar>
        </q-item-section>

        <q-item-section>
          <q-item-label class="text-weight-medium">
            {{ mention.author.name }}
            <span class="text-grey-6 text-caption q-ml-xs">
              @{{ mention.author.username }}
            </span>
          </q-item-label>

          <q-item-label class="mention__text q-mt-xs">
            <template v-for="(token, index) in tokenizeXText(mention.text)" :key="index">
              <a
                v-if="token.href"
                :href="token.href"
                target="_blank"
                rel="noopener"
              >{{ token.value }}</a>
              <template v-else>{{ token.value }}</template>
            </template>
          </q-item-label>

          <div v-if="mention.media.length" class="mention__media q-mt-sm">
            <img
              v-for="item in mention.media"
              :key="item.url"
              :src="item.url"
              :alt="item.alt"
              loading="lazy"
            />
          </div>

          <q-item-label caption class="q-mt-sm">
            {{ formatXDate(mention.createdAt) }}
            ·
            <a :href="mention.permalink" target="_blank" rel="noopener">View on X</a>
            <span v-if="mention.moderatedBy"> · reviewed by {{ mention.moderatedBy }}</span>
          </q-item-label>
        </q-item-section>

        <q-item-section side top>
          <div class="column q-gutter-xs items-end">
            <q-btn
              v-if="mention.status !== 'approved'"
              dense
              unelevated
              no-caps
              color="positive"
              icon="check"
              label="Approve"
              @click="decide(mention, 'approved')"
            />
            <q-btn
              v-if="mention.status !== 'rejected'"
              dense
              flat
              no-caps
              color="negative"
              icon="block"
              label="Reject"
              @click="decide(mention, 'rejected')"
            />
            <q-btn
              v-if="mention.status === 'approved'"
              dense
              flat
              no-caps
              icon="undo"
              label="Unpublish"
              @click="decide(mention, 'pending')"
            />
            <q-btn
              dense
              flat
              icon="delete"
              color="negative"
              aria-label="Delete mention"
              @click="confirmRemove(mention)"
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<style scoped>
.mention__text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.mention__media {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 6px;
}

.mention__media img {
  width: 100%;
  border-radius: 8px;
  display: block;
}
</style>
