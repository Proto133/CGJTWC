<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useEventsStore } from 'stores/events'
import { useAnnouncementsStore } from 'stores/announcements'
import EventCard from 'components/EventCard.vue'
import AnnouncementCard from 'components/AnnouncementCard.vue'
import XTimeline from 'components/XTimeline.vue'
import { organization } from 'src/config/organization'

const org = organization
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
  <q-page>
    <!-- Hero -->
    <section class="hero">
      <!-- Decorative watermark; hidden from assistive tech. -->
      <img src="/assets/JTWC-white-512.png" alt="" class="hero__watermark" aria-hidden="true" />

      <div class="page-shell hero__inner">
        <div class="hero__eyebrow">{{ org.location.city }}, {{ org.location.state }}</div>
        <h1 class="display-xl hero__title">
          {{ org.identity.heroLine1 }}<br />{{ org.identity.heroLine2 }}
        </h1>
        <p class="hero__tagline">{{ org.identity.heroTagline }}</p>

        <div class="hero__actions">
          <q-btn
            to="/schedule"
            label="View Schedule"
            color="white"
            text-color="primary"
            unelevated
            no-caps
            size="lg"
            class="hero__btn"
          />
          <q-btn
            to="/contact"
            label="Join the Team"
            outline
            color="white"
            no-caps
            size="lg"
            class="hero__btn"
          />
        </div>
      </div>
    </section>

    <div class="page-shell">
      <!-- About teaser + social -->
      <section class="section row q-col-gutter-lg">
        <div class="col-12 col-md-7">
          <h2 class="section-title">About the Club</h2>
          <p class="lead q-mt-md">{{ org.content.aboutTeaser }}</p>
          <q-btn
            to="/about"
            label="Learn more"
            color="primary"
            flat
            no-caps
            class="q-mt-sm"
            icon-right="arrow_forward"
          />
        </div>

        <div class="col-12 col-md-5">
          <XTimeline :limit="3" />
        </div>
      </section>

      <!-- Upcoming events -->
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">Upcoming Events</h2>
          <q-btn
            to="/schedule"
            flat
            no-caps
            dense
            label="Full schedule"
            color="primary"
            icon-right="arrow_forward"
            class="tap-target"
          />
        </div>

        <div v-if="upcoming.length" class="row q-col-gutter-md q-mt-sm">
          <div v-for="event in upcoming" :key="event.id" class="col-12 col-sm-6 col-md-4">
            <EventCard :event="event" />
          </div>
        </div>
        <div v-else class="empty-state q-mt-sm">
          No upcoming events scheduled yet. Check back soon.
        </div>
      </section>

      <!-- Announcements -->
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">Latest News</h2>
          <q-btn
            to="/announcements"
            flat
            no-caps
            dense
            label="All announcements"
            color="primary"
            icon-right="arrow_forward"
            class="tap-target"
          />
        </div>

        <div v-if="latestAnnouncements.length" class="row q-col-gutter-md q-mt-sm">
          <div v-for="ann in latestAnnouncements" :key="ann.id" class="col-12 col-md-4">
            <AnnouncementCard :announcement="ann" />
          </div>
        </div>
        <div v-else class="empty-state q-mt-sm">
          No announcements yet.
        </div>
      </section>

      <!-- Call to action -->
      <section class="section cta">
        <h2 class="cta__title">{{ org.content.ctaHeading }}</h2>
        <p class="cta__text">{{ org.content.ctaText }}</p>
        <q-btn
          to="/contact"
          label="Contact Us"
          color="white"
          text-color="primary"
          unelevated
          no-caps
          size="lg"
        />
      </section>
    </div>
  </q-page>
</template>

<style scoped>
/* Hero ---------------------------------------------------------------- */
.hero {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(120% 130% at 12% 0%, var(--navy-700) 0%, transparent 55%),
    linear-gradient(160deg, var(--navy-800) 0%, var(--navy-900) 100%);
  color: #fff;
  padding: clamp(2.75rem, 9vw, 6rem) 0 clamp(2.5rem, 8vw, 5rem);
}

.hero__watermark {
  position: absolute;
  right: -10%;
  bottom: -22%;
  width: min(62vw, 460px);
  opacity: 0.07;
  pointer-events: none;
  user-select: none;
}

.hero__inner {
  position: relative;
  z-index: 1;
}

.hero__eyebrow {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.8rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 0.75rem;
}

.hero__title {
  margin: 0;
  color: #fff;
}

.hero__tagline {
  margin: 1rem 0 0;
  font-size: clamp(1.02rem, 2.8vw, 1.3rem);
  color: rgba(255, 255, 255, 0.78);
  max-width: 34ch;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: clamp(1.5rem, 4vw, 2.25rem);
}

.hero__btn {
  border-radius: 10px;
  font-weight: 600;
  min-height: 48px;
}

/* Section heads ------------------------------------------------------- */
.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

/* CTA ----------------------------------------------------------------- */
.cta {
  background: linear-gradient(150deg, var(--navy-800) 0%, var(--navy-900) 100%);
  color: #fff;
  border-radius: var(--radius-lg);
  padding: clamp(1.75rem, 5vw, 3rem) clamp(1.25rem, 4vw, 2.5rem);
  text-align: center;
}

.cta__title {
  color: #fff;
  font-size: clamp(1.6rem, 5vw, 2.4rem);
  text-transform: uppercase;
  margin: 0;
}

.cta__text {
  color: rgba(255, 255, 255, 0.78);
  margin: 0.6rem 0 1.4rem;
}
</style>
