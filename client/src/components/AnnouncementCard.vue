<script setup lang="ts">
import type { Announcement } from 'src/types'
import { date } from 'quasar'

const props = defineProps<{ announcement: Announcement }>()

const formattedDate = date.formatDate(props.announcement.createdAt.toDate(), 'MMM D, YYYY')
</script>

<template>
  <q-card flat bordered class="announcement-card card-interactive q-mb-md">
    <q-card-section>
      <div class="announcement-head">
        <h3 class="announcement-title">{{ announcement.title }}</h3>
        <span v-if="announcement.pinned" class="pinned-badge">Pinned</span>
      </div>
      <div class="announcement-date">{{ formattedDate }}</div>
      <div class="announcement-body">{{ announcement.body }}</div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.announcement-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}

.announcement-title {
  font-size: 1.3rem;
  line-height: 1.15;
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: break-word;
}

.announcement-date {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--grey-400);
  margin-top: 6px;
}

.announcement-body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin-top: 12px;
  line-height: 1.65;
  color: var(--grey-600);
}
</style>
