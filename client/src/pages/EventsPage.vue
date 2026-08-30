<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useEventsStore } from 'stores/events'
import EventCard from 'components/EventCard.vue'
import { matchesGroupFilter } from 'src/utils/eventGroups'
import { groupByWeek } from 'src/utils/eventPeriods'
import type { Event, EventType } from 'src/types'

const eventsStore = useEventsStore()

type Range = 'upcoming' | 'past' | 'all'
const range = ref<Range>('upcoming')

/**
 * Empty means no filtering, which is what keeps the default view complete.
 *
 * Both filters are multi-select: a family with a wrestler in each squad ticks
 * both, and somebody who only cares about tournaments ticks one type.
 */
const selectedSquads = ref<string[]>([])
const selectedTypes = ref<EventType[]>([])

onMounted(() => {
  eventsStore.subscribe()
})

onUnmounted(() => {
  eventsStore.unsubscribeFromEvents()
})

const TYPE_LABELS: Record<EventType, string> = {
  practice: 'Practices',
  dual: 'Duals',
  tournament: 'Tournaments',
  other: 'Other',
}

const TYPE_ORDER: EventType[] = ['practice', 'dual', 'tournament', 'other']

/**
 * Only the types actually on the schedule.
 *
 * Offering a "Duals" chip that matches nothing invites a visitor to tick it and
 * conclude the site is broken.
 */
const typesInUse = computed(() => {
  const present = new Set(eventsStore.events.map((e) => e.type))
  return TYPE_ORDER.filter((type) => present.has(type))
})

const inRange = computed<Event[]>(() => {
  if (range.value === 'upcoming') return eventsStore.upcomingEvents()
  // Most recent first: the far end of a season's history is nobody's interest.
  if (range.value === 'past') return [...eventsStore.pastEvents()].reverse()
  return eventsStore.events
})

const filteredEvents = computed(() =>
  inRange.value.filter(
    (event) =>
      (selectedTypes.value.length === 0 || selectedTypes.value.includes(event.type))
      && matchesGroupFilter(event.group, selectedSquads.value, eventsStore.squads),
  ))

/** Weeks, because a season is about seventy events and a flat list of that
 *  length is unreadable. */
const weeks = computed(() =>
  groupByWeek(filteredEvents.value, (event) => event.date.toDate()))

const filtersActive = computed(() =>
  selectedSquads.value.length > 0 || selectedTypes.value.length > 0)

function toggleSquad(squad: string) {
  selectedSquads.value = selectedSquads.value.includes(squad)
    ? selectedSquads.value.filter((s) => s !== squad)
    : [...selectedSquads.value, squad]
}

function toggleType(type: EventType) {
  selectedTypes.value = selectedTypes.value.includes(type)
    ? selectedTypes.value.filter((t) => t !== type)
    : [...selectedTypes.value, type]
}

function clearFilters() {
  selectedSquads.value = []
  selectedTypes.value = []
}
</script>

<template>
  <q-page>
    <div class="page-shell page-shell--mid">
      <header class="page-header">
        <div class="eyebrow">Season Calendar</div>
        <h1 class="page-title">Schedule &amp; Events</h1>
        <p class="lead">Practices, dual meets and tournaments for the season.</p>
      </header>

      <!-- full-width on small screens so the control never overflows -->
      <q-btn-toggle
        v-model="range"
        toggle-color="primary"
        text-color="primary"
        color="white"
        no-caps
        spread
        unelevated
        class="filter-toggle"
        :options="[
          { label: 'Upcoming', value: 'upcoming' },
          { label: 'Past', value: 'past' },
          { label: 'All', value: 'all' },
        ]"
      />

      <!-- Squad chips only appear once the schedule actually has squads on it,
           so a club that never fills the column sees no dead controls. -->
      <div v-if="eventsStore.squads.length > 1" class="chip-row">
        <span class="chip-row__label">Squad</span>
        <q-chip
          v-for="squad in eventsStore.squads"
          :key="squad"
          clickable
          :outline="!selectedSquads.includes(squad)"
          :color="selectedSquads.includes(squad) ? 'primary' : undefined"
          :text-color="selectedSquads.includes(squad) ? 'white' : 'primary'"
          @click="toggleSquad(squad)"
        >
          {{ squad }}
        </q-chip>
      </div>

      <div v-if="typesInUse.length > 1" class="chip-row">
        <span class="chip-row__label">Type</span>
        <q-chip
          v-for="type in typesInUse"
          :key="type"
          clickable
          :outline="!selectedTypes.includes(type)"
          :color="selectedTypes.includes(type) ? 'primary' : undefined"
          :text-color="selectedTypes.includes(type) ? 'white' : 'primary'"
          @click="toggleType(type)"
        >
          {{ TYPE_LABELS[type] }}
        </q-chip>
      </div>

      <div v-if="filtersActive" class="filter-summary">
        Showing {{ filteredEvents.length }} of {{ inRange.length }}
        <q-btn flat dense no-caps size="sm" label="Clear filters" @click="clearFilters" />
      </div>

      <!-- Events with no squad recorded are never filtered out, so this only
           needs saying while a squad filter is on. -->
      <div v-if="selectedSquads.length > 0" class="filter-note">
        Events with no squad listed are always shown.
      </div>

      <div v-if="eventsStore.loading" class="text-center q-pa-xl">
        <q-spinner color="primary" size="lg" />
      </div>

      <div v-else-if="filteredEvents.length === 0" class="empty-state">
        <template v-if="filtersActive">
          Nothing matches those filters.
          <q-btn flat dense no-caps size="sm" label="Clear them" @click="clearFilters" />
        </template>
        <template v-else-if="range === 'upcoming'">
          No upcoming events are on the calendar yet. Check back soon.
        </template>
        <template v-else>
          No events found for this filter.
        </template>
      </div>

      <template v-else>
        <section v-for="week in weeks" :key="week.key" class="week">
          <h2 class="week__label">{{ week.label }}</h2>
          <div class="row q-col-gutter-md">
            <div v-for="event in week.events" :key="event.id" class="col-12 col-md-6">
              <EventCard :event="event" :known-squads="eventsStore.squads" />
            </div>
          </div>
        </section>
      </template>
    </div>
  </q-page>
</template>

<style scoped>
.filter-toggle {
  border: 1px solid var(--grey-200);
  border-radius: 999px;
  overflow: hidden;
  width: 100%;
  max-width: 420px;
}

.chip-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.chip-row__label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--grey-500);
  /* Aligns the two rows of chips with each other. */
  min-width: 52px;
}

.filter-summary {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  font-size: 0.86rem;
  color: var(--grey-600);
}

.filter-note {
  margin-top: 2px;
  font-size: 0.8rem;
  color: var(--grey-500);
}

.week {
  margin-top: 28px;
}

.week__label {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--navy-800);
  margin: 0 0 12px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--grey-200);
}
</style>
