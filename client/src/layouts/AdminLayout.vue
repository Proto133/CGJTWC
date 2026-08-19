<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from 'stores/auth'
import { useRouter } from 'vue-router'
import { useSettingsStore } from 'stores/settings'

const settings = useSettingsStore()
const org = computed(() => settings.org)
const authStore = useAuthStore()
const router = useRouter()

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

        <div class="q-gutter-x-sm">
          <q-btn flat to="/" icon="home" label="View Site" />
          <q-btn
            flat
            @click="handleLogout"
            icon="logout"
            label="Logout"
          />
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
