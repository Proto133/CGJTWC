<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAnnouncementsStore } from 'stores/announcements'
import AnnouncementCard from 'components/AnnouncementCard.vue'

const store = useAnnouncementsStore()

onMounted(() => store.subscribe())
onUnmounted(() => store.unsubscribeFromAnnouncements())
</script>

<template>
  <q-page padding>
    <div style="max-width: 800px; margin: 0 auto;">
      <h1 class="section-title q-mb-lg">Announcements</h1>

      <div v-if="store.loading" class="text-center q-pa-xl">
        <q-spinner color="primary" size="lg" />
      </div>

      <template v-else>
        <!-- Pinned -->
        <div v-if="store.pinnedAnnouncements().length">
          <h6 class="text-primary q-mb-sm">Pinned</h6>
          <AnnouncementCard
            v-for="a in store.pinnedAnnouncements()"
            :key="a.id"
            :announcement="a"
          />
        </div>

        <!-- Regular -->
        <div v-if="store.regularAnnouncements().length" class="q-mt-md">
          <h6 class="text-primary q-mb-sm">Recent</h6>
          <AnnouncementCard
            v-for="a in store.regularAnnouncements()"
            :key="a.id"
            :announcement="a"
          />
        </div>

        <div v-if="store.announcements.length === 0" class="text-grey-6">
          No announcements have been published yet.
        </div>
      </template>
    </div>
  </q-page>
</template>
