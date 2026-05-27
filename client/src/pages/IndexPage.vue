<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useEventsStore } from 'stores/events'
import { useAnnouncementsStore } from 'stores/announcements'
import EventCard from 'components/EventCard.vue'
import AnnouncementCard from 'components/AnnouncementCard.vue'
import XTimeline from 'components/XTimeline.vue'

const eventsStore = useEventsStore()
const announcementsStore = useAnnouncementsStore()

const upcoming = computed(() => eventsStore.upcomingEvents().slice(0, 3))
const latestAnnouncements = computed(() => announcementsStore.announcements.slice(0, 3))

onMounted(() => {
  eventsStore.subscribe()
  announcementsStore.subscribe()
})

onUnmounted(() => {
  eventsStore.unsubscribeFromEvents()
  announcementsStore.unsubscribeFromAnnouncements()
})
</script>

<template>
  <!-- Hero -->
  <div class="hero bg-primary text-white q-pa-xl text-center">
    <div class="text-h3 text-weight-bold q-mb-md">
      Cary Grove Junior Trojans
    </div>
    <div class="text-h6 q-mb-lg" style="opacity: 0.95">
      Building Strength, Discipline &amp; Champions
    </div>
    <div class="q-gutter-md">
      <q-btn to="/schedule" label="View Schedule" color="white" text-color="primary" size="lg" />
      <q-btn to="/contact" label="Join the Team" outline color="white" size="lg" />
    </div>
  </div>

  <div class="q-pa-md q-pa-lg-md" style="max-width: 1100px; margin: 0 auto;">
    <!-- Quick About Teaser -->
    <div class="row q-col-gutter-lg q-mt-lg">
      <div class="col-12 col-md-7">
        <h2 class="section-title">About CGJT Wrestling</h2>
        <p class="text-body1">
          The Cary Grove Junior Trojans Wrestling program develops young athletes in the Cary Grove community
          through hard work, sportsmanship, and a love for the sport. We welcome wrestlers of all experience levels.
        </p>
        <q-btn to="/about" label="Learn More" flat color="primary" />
      </div>

      <div class="col-12 col-md-5">
        <XTimeline handle="CGJTWrestling" :limit="3" />
      </div>
    </div>

    <!-- Upcoming Events Teaser -->
    <div class="q-mt-xl">
      <div class="row items-center q-mb-md">
        <h2 class="section-title q-mr-auto">Upcoming Events</h2>
        <q-btn to="/schedule" flat label="Full Schedule" color="primary" />
      </div>

      <div v-if="upcoming.length" class="row q-col-gutter-md">
        <div v-for="event in upcoming" :key="event.id" class="col-12 col-sm-6 col-md-4">
          <EventCard :event="event" />
        </div>
      </div>
      <div v-else class="text-grey-6 q-pa-md">
        No upcoming events scheduled yet. Check back soon!
      </div>
    </div>

    <!-- Announcements Teaser -->
    <div class="q-mt-xl">
      <div class="row items-center q-mb-md">
        <h2 class="section-title q-mr-auto">Latest Announcements</h2>
        <q-btn to="/announcements" flat label="All Announcements" color="primary" />
      </div>

      <div v-if="latestAnnouncements.length" class="row q-col-gutter-md">
        <div v-for="ann in latestAnnouncements" :key="ann.id" class="col-12 col-md-4">
          <AnnouncementCard :announcement="ann" />
        </div>
      </div>
      <div v-else class="text-grey-6 q-pa-md">
        No announcements yet.
      </div>
    </div>

    <!-- Call to Action -->
    <div class="q-mt-xl q-pa-lg bg-primary text-white text-center" style="border-radius: 12px">
      <div class="text-h5 q-mb-sm">Ready to wrestle?</div>
      <div class="q-mb-md">New wrestlers and families are always welcome.</div>
      <q-btn to="/contact" label="Contact Us" color="gold" text-color="dark" size="lg" />
    </div>
  </div>
</template>

<style scoped>
.hero {
  background: linear-gradient(135deg, #00205B 0%, #00153D 100%);
}
</style>
