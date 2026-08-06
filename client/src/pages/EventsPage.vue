<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useEventsStore } from 'stores/events'
import EventCard from 'components/EventCard.vue'

const eventsStore = useEventsStore()
const filter = ref<'all' | 'upcoming' | 'past'>('upcoming')

onMounted(() => {
  eventsStore.subscribe()
})

onUnmounted(() => {
  eventsStore.unsubscribeFromEvents()
})

const filteredEvents = computed(() => {
  if (filter.value === 'upcoming') return eventsStore.upcomingEvents()
  if (filter.value === 'past') return eventsStore.pastEvents()
  return eventsStore.events
})
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
        v-model="filter"
        toggle-color="primary"
        text-color="primary"
        color="white"
        no-caps
        spread
        unelevated
        class="filter-toggle q-mb-lg"
        :options="[
          { label: 'Upcoming', value: 'upcoming' },
          { label: 'Past', value: 'past' },
          { label: 'All', value: 'all' },
        ]"
      />

      <div v-if="eventsStore.loading" class="text-center q-pa-xl">
        <q-spinner color="primary" size="lg" />
      </div>

      <div v-else-if="filteredEvents.length === 0" class="empty-state">
        No events found for this filter.
      </div>

      <div v-else class="row q-col-gutter-md">
        <div v-for="event in filteredEvents" :key="event.id" class="col-12 col-md-6">
          <EventCard :event="event" />
        </div>
      </div>
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
</style>
