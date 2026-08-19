<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useStaffStore } from 'stores/staff'

const staffStore = useStaffStore()

onMounted(() => staffStore.subscribe())
onUnmounted(() => staffStore.unsubscribeFromStaff())
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
          <q-card flat bordered class="staff-card card-interactive">
            <q-card-section>
              <div class="staff-card__role">{{ member.role }}</div>
              <h2 class="staff-card__name">
                {{ member.firstName }} {{ member.lastName }}
              </h2>
              <p v-if="member.bio" class="staff-card__bio">{{ member.bio }}</p>
              <a
                v-if="member.email"
                :href="`mailto:${member.email}`"
                class="staff-card__email"
              >{{ member.email }}</a>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.staff-card {
  height: 100%;
}

.staff-card__role {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--grey-400);
}

.staff-card__name {
  font-size: 1.4rem;
  line-height: 1.15;
  margin: 6px 0 0;
  overflow-wrap: break-word;
}

.staff-card__bio {
  margin: 10px 0 0;
  color: var(--grey-600);
  line-height: 1.6;
  /* Bios are free text, so guard against unbroken strings widening the card. */
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.staff-card__email {
  display: inline-block;
  margin-top: 10px;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}
</style>
