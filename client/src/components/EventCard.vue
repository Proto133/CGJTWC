<script setup lang="ts">
import type { Event } from 'src/types'
import { date } from 'quasar'

const props = defineProps<{ event: Event }>()

const formattedDate = date.formatDate(props.event.date.toDate(), 'ddd, MMM D, YYYY')

const typeColors: Record<string, string> = {
  practice: 'type-practice',
  dual: 'type-dual',
  tournament: 'type-tournament',
  other: 'type-other',
}
</script>

<template>
  <q-card flat bordered class="q-mb-md">
    <q-card-section>
      <div class="row items-center q-mb-sm">
        <div class="col">
          <div class="text-h6 text-weight-bold text-primary">{{ event.title }}</div>
          <div class="text-caption text-grey-7">{{ formattedDate }} <span v-if="event.time">• {{ event.time }}</span></div>
        </div>
        <div>
          <span :class="['event-type-badge', typeColors[event.type]]">
            {{ event.type }}
          </span>
        </div>
      </div>

      <div class="text-body2">
        <q-icon name="place" size="sm" class="q-mr-xs" />
        {{ event.location }}
      </div>

      <div v-if="event.opponent" class="text-body2 q-mt-xs">
        <strong>vs</strong> {{ event.opponent }}
      </div>

      <div v-if="event.description" class="text-body2 q-mt-sm text-grey-8">
        {{ event.description }}
      </div>
    </q-card-section>
  </q-card>
</template>
