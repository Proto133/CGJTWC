<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from 'stores/auth'
import { useRoute, useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const showPassword = ref(false)

async function handleLogin() {
  const success = await authStore.login(email.value, password.value)
  if (success) {
    const redirect = (route.query.redirect as string) || '/admin'
    router.push(redirect)
  }
}
</script>

<template>
  <q-page padding class="flex flex-center">
    <q-card class="admin-card" style="width: 100%; max-width: 380px;">
      <q-card-section>
        <div class="text-h5 text-center text-primary q-mb-lg">
          CGJT Admin Login
        </div>

        <q-form @submit.prevent="handleLogin" class="q-gutter-md">
          <q-input
            v-model="email"
            type="email"
            label="Email"
            required
            outlined
            autocomplete="username"
          />

          <q-input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            label="Password"
            required
            outlined
            autocomplete="current-password"
          >
            <template #append>
              <q-icon
                :name="showPassword ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>

          <q-btn
            type="submit"
            label="Sign In"
            color="primary"
            class="full-width q-mt-md"
            :loading="authStore.loading"
          />
        </q-form>
      </q-card-section>

      <q-card-section class="text-caption text-center text-grey-6">
        Only authorized club administrators may access this area.
      </q-card-section>
    </q-card>
  </q-page>
</template>

<style scoped>
</style>
