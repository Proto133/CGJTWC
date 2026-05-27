<script setup lang="ts">
import { useAuthStore } from 'stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

async function handleLogout() {
  await authStore.logout()
  router.push('/admin/login')
}
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <q-header class="bg-primary text-white" elevated>
      <q-toolbar>
        <q-toolbar-title class="text-h6">
          <span class="text-gold">CGJT</span> Admin Dashboard
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
.text-gold {
  color: #C9A227;
}
</style>
