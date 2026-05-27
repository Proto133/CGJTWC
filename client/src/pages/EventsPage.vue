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
  <q-page padding>
    <div style="max-width: 900px; margin: 0 auto;">
      <h1 class="section-title q-mb-lg">Schedule &amp; Events</h1>

      <div class="q-mb-md">
        <q-btn-toggle
          v-model="filter"
          toggle-color="primary"
          :options="[
            { label: 'Upcoming', value: 'upcoming' },
            { label: 'Past', value: 'past' },
            { label: 'All', value: 'all' },
          ]"
          unelevated
        />
      </div>

      <div v-if="eventsStore.loading" class="text-center q-pa-xl">
        <q-spinner color="primary" size="lg" />
      </div>

      <div v-else-if="filteredEvents.length === 0" class="text-grey-6 q-pa-md">
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
</style>
