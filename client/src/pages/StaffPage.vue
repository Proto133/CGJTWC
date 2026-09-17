<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useStaffStore } from 'stores/staff'
import StaffCard from 'components/StaffCard.vue'
import type { StaffMember } from 'src/types'

const staffStore = useStaffStore()

onMounted(() => staffStore.subscribe())
onUnmounted(() => staffStore.unsubscribeFromStaff())

const bioOpen = ref(false)
const selected = ref<StaffMember | null>(null)

function openBio(member: StaffMember) {
  selected.value = member
  bioOpen.value = true
}
</script>

<template>
  <q-page>
    <div class="page-shell page-shell--mid">
      <header class="page-header">
        <div class="eyebrow">Our Team</div>
        <h1 class="page-title">Coaches &amp; Staff</h1>
        <p class="lead">
          The volunteers who run practices, meets and everything in between.
        </p>
      </header>

      <div v-if="staffStore.loading" class="text-center q-pa-xl">
        <q-spinner color="primary" size="lg" />
      </div>

      <div v-else-if="staffStore.staff.length === 0" class="empty-state">
        Staff bios have not been added yet.
      </div>

      <div v-else class="row q-col-gutter-md">
        <div
          v-for="member in staffStore.staff"
          :key="member.id"
          class="col-12 col-sm-6"
        >
          <StaffCard :member="member" @open="openBio(member)" />
        </div>
      </div>
    </div>

    <q-dialog v-model="bioOpen">
      <q-card v-if="selected" class="bio-card">
        <q-card-section>
          <div class="bio-card__role">{{ selected.role }}</div>
          <h2 class="bio-card__name">
            {{ selected.firstName }} {{ selected.lastName }}
          </h2>
        </q-card-section>

        <q-separator />

        <!-- Scrolls rather than growing past the viewport: a long bio would
             otherwise push the close button off the bottom of a phone. -->
        <q-card-section class="bio-card__body">
          <p class="bio-card__bio">{{ selected.bio }}</p>
          <a
            v-if="selected.email"
            :href="`mailto:${selected.email}`"
            class="bio-card__email"
          >{{ selected.email }}</a>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Close" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.bio-card {
  width: 560px;
  max-width: 94vw;
}

.bio-card__role {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--grey-400);
}

.bio-card__name {
  font-size: 1.5rem;
  line-height: 1.15;
  margin: 6px 0 0;
  overflow-wrap: break-word;
}

.bio-card__body {
  max-height: 60vh;
  overflow-y: auto;
}

.bio-card__bio {
  margin: 0;
  color: var(--grey-600);
  line-height: 1.7;
  overflow-wrap: anywhere;
  /* Paragraph breaks the coach typed are kept, as on the card. */
  white-space: pre-wrap;
}

.bio-card__email {
  display: inline-block;
  margin-top: 14px;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}
</style>
