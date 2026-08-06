<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAnnouncementsStore } from 'stores/announcements'
import AnnouncementCard from 'components/AnnouncementCard.vue'

const store = useAnnouncementsStore()

onMounted(() => store.subscribe())
onUnmounted(() => store.unsubscribeFromAnnouncements())
</script>

<template>
  <q-page>
    <div class="page-shell page-shell--mid">
      <header class="page-header">
        <div class="eyebrow">Team News</div>
        <h1 class="page-title">Announcements</h1>
        <p class="lead">Updates from the coaching staff for wrestlers and families.</p>
      </header>

      <div v-if="store.loading" class="text-center q-pa-xl">
        <q-spinner color="primary" size="lg" />
      </div>

      <template v-else>
        <!-- Pinned -->
        <section v-if="store.pinnedAnnouncements().length">
          <div class="subsection-title q-mb-sm">Pinned</div>
          <AnnouncementCard
            v-for="a in store.pinnedAnnouncements()"
            :key="a.id"
            :announcement="a"
          />
        </section>

        <!-- Regular -->
        <section v-if="store.regularAnnouncements().length" class="q-mt-lg">
          <div class="subsection-title q-mb-sm">Recent</div>
          <AnnouncementCard
            v-for="a in store.regularAnnouncements()"
            :key="a.id"
            :announcement="a"
          />
        </section>

        <div v-if="store.announcements.length === 0" class="empty-state">
          No announcements have been published yet.
        </div>
      </template>
    </div>
  </q-page>
</template>
