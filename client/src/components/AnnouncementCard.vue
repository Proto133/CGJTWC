<script setup lang="ts">
import type { Announcement } from 'src/types'
import { date } from 'quasar'

const props = defineProps<{ announcement: Announcement }>()

const formattedDate = date.formatDate(props.announcement.createdAt.toDate(), 'MMM D, YYYY')
</script>

<template>
  <q-card flat bordered class="q-mb-md">
    <q-card-section>
      <div class="row items-start">
        <div class="col">
          <div class="text-h6 text-weight-bold text-primary">
            {{ announcement.title }}
            <q-badge v-if="announcement.pinned" color="gold" text-color="dark" class="q-ml-sm">Pinned</q-badge>
          </div>
          <div class="text-caption text-grey-6 q-mb-sm">{{ formattedDate }}</div>
        </div>
      </div>

      <div class="text-body1" style="white-space: pre-wrap">{{ announcement.body }}</div>
    </q-card-section>
  </q-card>
</template>
