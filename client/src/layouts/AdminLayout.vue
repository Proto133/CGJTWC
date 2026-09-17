<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from 'stores/auth'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from 'stores/settings'

const settings = useSettingsStore()
const org = computed(() => settings.org)
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

/**
 * The way back out of any admin screen that is not the dashboard.
 *
 * Without it the only exits from a sub-page were leaving the admin area
 * entirely or logging out, which is no exit at all from something like the
 * scoring screen that someone opens, uses and wants to step away from.
 */
const showDashboard = computed(() => route.name !== 'admin-dashboard'
  && route.name !== 'admin-login')

async function handleLogout() {
  await authStore.logout()
  void router.push('/admin/login')
}
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <q-header class="bg-primary text-white" elevated>
      <q-toolbar>
        <q-toolbar-title class="admin-title">
          {{ org.identity.shortName }} <span class="admin-title__muted">Admin</span>
        </q-toolbar-title>

        <!-- Labels drop away on a phone so three of these still fit a toolbar
             next to the club name. -->
        <div class="q-gutter-x-xs">
          <q-btn
            v-if="showDashboard"
            flat
            dense
            no-caps
            to="/admin"
            icon="grid_view"
            aria-label="Back to the dashboard"
          >
            <span class="gt-xs q-ml-xs">Dashboard</span>
          </q-btn>
          <q-btn flat dense no-caps to="/" icon="home" aria-label="View the site">
            <span class="gt-xs q-ml-xs">View Site</span>
          </q-btn>
          <q-btn flat dense no-caps icon="logout" aria-label="Log out" @click="handleLogout">
            <span class="gt-xs q-ml-xs">Logout</span>
          </q-btn>
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <div class="q-pa-md">
        <router-view />
      </div>
    </q-page-container>

    <q-footer class="bg-grey-9 text-white q-pa-sm text-caption text-center">
      Admin area — changes are live for all visitors
    </q-footer>
  </q-layout>
</template>

<style scoped>
.admin-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.35rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.admin-title__muted {
  color: rgba(255, 255, 255, 0.6);
}
</style>
