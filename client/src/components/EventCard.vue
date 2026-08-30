<script setup lang="ts">
import type { Event } from 'src/types'
import { date } from 'quasar'
import { computed } from 'vue'
import { eventSquads } from 'src/utils/eventGroups'

// knownSquads lets ALL expand to the squads the club actually runs. Passed in
// rather than read from the store so the card stays presentational.
const props = defineProps<{
  event: Event
  knownSquads?: string[] | undefined
}>()

const eventDate = computed(() => props.event.date.toDate())
const month = computed(() => date.formatDate(eventDate.value, 'MMM'))
const day = computed(() => date.formatDate(eventDate.value, 'D'))
const weekday = computed(() => date.formatDate(eventDate.value, 'dddd'))

// Two badges for ALL, one for a single squad, none when the field is blank.
const squads = computed(() => eventSquads(props.event.group, props.knownSquads ?? []))

const typeColors: Record<string, string> = {
  practice: 'type-practice',
  dual: 'type-dual',
  tournament: 'type-tournament',
  other: 'type-other',
}
</script>

<template>
  <q-card flat bordered class="event-card card-interactive">
    <div class="event-card__body">
      <!-- Date block reads far faster than an inline date string in a list. -->
      <div class="date-block" aria-hidden="true">
        <div class="date-block__month">{{ month }}</div>
        <div class="date-block__day">{{ day }}</div>
      </div>

      <div class="event-card__content">
        <div class="event-card__head">
          <h3 class="event-card__title">{{ event.title }}</h3>
          <span :class="['event-type-badge', typeColors[event.type]]">
            {{ event.type }}
          </span>
          <span
            v-for="squad in squads"
            :key="squad"
            class="event-type-badge squad-badge"
          >
            {{ squad }}
          </span>
        </div>

        <div class="event-card__meta">
          <span class="event-card__meta-item">
            <q-icon name="schedule" size="16px" />
            {{ weekday }}<template v-if="event.time"> · {{ event.time }}</template>
          </span>
          <span class="event-card__meta-item">
            <q-icon name="place" size="16px" />
            {{ event.location }}
          </span>
          <span v-if="event.opponent" class="event-card__meta-item">
            <q-icon name="sports_kabaddi" size="16px" />
            vs {{ event.opponent }}
          </span>
        </div>

        <p v-if="event.description" class="event-card__desc">
          {{ event.description }}
        </p>
      </div>
    </div>
  </q-card>
</template>

<style scoped>
.event-card {
  height: 100%;
}

.event-card__body {
  display: flex;
  gap: 14px;
  padding: 16px;
  align-items: flex-start;
}

.event-card__content {
  /* Without min-width:0 a long location string would stretch the flex item and
     push the card past the viewport on narrow screens. */
  min-width: 0;
  flex: 1 1 auto;
}

.event-card__head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.event-card__title {
  font-size: 1.25rem;
  line-height: 1.15;
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: break-word;
}

.squad-badge {
  /* Outlined rather than filled, so squad badges read as secondary to the event
     type badge they sit beside instead of competing with it. */
  background: transparent;
  border: 1px solid var(--grey-400, #b0b6c0);
  color: var(--grey-600);
}

.event-card__meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.event-card__meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: var(--grey-600);
  min-width: 0;
  overflow-wrap: anywhere;
}

.event-card__desc {
  margin: 10px 0 0;
  font-size: 0.9rem;
  color: var(--grey-500);
  line-height: 1.55;
}
</style>
