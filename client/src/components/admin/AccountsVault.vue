<script setup lang="ts">
import { ref, computed } from 'vue'
import { Dialog, Notify, copyToClipboard } from 'quasar'
import { useVaultStore } from 'stores/vault'
import { passphraseProblem } from 'src/utils/vaultCrypto'
import type { VaultItem, VaultItemInput } from 'src/types'

const vault = useVaultStore()

const passphrase = ref('')
const confirmPassphrase = ref('')
const showPassphrase = ref(false)
const search = ref('')

const editorOpen = ref(false)
const editingId = ref<string | null>(null)
const editorPassword = ref('')
const editor = ref<VaultItemInput>(blankItem())

const rotateOpen = ref(false)
const rotateCurrent = ref('')
const rotateNext = ref('')

/** Plaintext currently on screen, keyed by item id. Cleared aggressively. */
const revealed = ref<Record<string, string>>({})

function blankItem(): VaultItemInput {
  return {
    platform: '', label: '', username: '', url: '',
    recoveryEmail: '', twoFactor: '', owner: '', notes: '', password: '',
  }
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return vault.items
  return vault.items.filter((i) =>
    [i.platform, i.label, i.username, i.owner].filter(Boolean)
      .join(' ').toLowerCase().includes(term))
})

const newPassphraseProblem = computed(() => passphraseProblem(passphrase.value))
const rotateProblem = computed(() => passphraseProblem(rotateNext.value))

async function handleCreate() {
  if (newPassphraseProblem.value) return
  if (passphrase.value !== confirmPassphrase.value) {
    Notify.create({ type: 'negative', message: 'Passphrases do not match' })
    return
  }
  const ok = await vault.createVault(passphrase.value)
  if (ok) { passphrase.value = ''; confirmPassphrase.value = '' }
}

async function handleUnlock() {
  const ok = await vault.unlock(passphrase.value)
  if (ok) passphrase.value = ''
}

function lockNow() {
  revealed.value = {}
  vault.lock()
}

async function toggleReveal(item: VaultItem) {
  if (revealed.value[item.id]) {
    // Re-hide by dropping it from memory rather than just visually masking it.
    const next = { ...revealed.value }
    delete next[item.id]
    revealed.value = next
    return
  }
  const plain = await vault.reveal(item)
  if (plain !== null) revealed.value = { ...revealed.value, [item.id]: plain }
}

async function copyPassword(item: VaultItem) {
  const plain = revealed.value[item.id] ?? await vault.reveal(item)
  if (plain === null) return
  try {
    await copyToClipboard(plain)
    Notify.create({ type: 'positive', message: `Copied the ${item.label} password` })
  } catch {
    Notify.create({ type: 'warning', message: 'Clipboard unavailable \u2014 reveal and copy manually' })
  }
}

function openNew() {
  editingId.value = null
  editor.value = blankItem()
  editorPassword.value = ''
  editorOpen.value = true
}

async function openEdit(item: VaultItem) {
  editingId.value = item.id
  editor.value = {
    platform: item.platform,
    label: item.label,
    username: item.username ?? '',
    url: item.url ?? '',
    recoveryEmail: item.recoveryEmail ?? '',
    twoFactor: item.twoFactor ?? '',
    owner: item.owner ?? '',
    notes: item.notes ?? '',
    password: '',
  }
  // Load the existing secret so an edit does not silently blank it.
  editorPassword.value = (await vault.reveal(item)) ?? ''
  editorOpen.value = true
}

async function saveEditor() {
  const ok = await vault.saveItem(
    { ...editor.value, password: editorPassword.value },
    editingId.value ?? undefined,
  )
  if (ok) {
    editorOpen.value = false
    editorPassword.value = ''
    revealed.value = {}
  }
}

function confirmDelete(item: VaultItem) {
  Dialog.create({
    title: 'Delete entry?',
    message: `"${item.label}" will be removed. This cannot be undone.`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void vault.removeItem(item.id)
  })
}

async function handleRotate() {
  if (rotateProblem.value) return
  const ok = await vault.changePassphrase(rotateCurrent.value, rotateNext.value)
  if (ok) {
    rotateOpen.value = false
    rotateCurrent.value = ''
    rotateNext.value = ''
    revealed.value = {}
  }
}
</script>

<template>
  <div>
    <div class="row items-center q-mb-md q-gutter-sm">
      <div class="text-h6">Account Vault</div>
      <q-space />
      <template v-if="vault.isUnlocked">
        <q-btn unelevated no-caps color="primary" icon="add" label="Add account" @click="openNew" />
        <q-btn flat no-caps icon="lock" label="Lock" @click="lockNow" />
      </template>
    </div>

    <!-- Still determining whether a vault exists -->
    <div v-if="!vault.metaLoaded" class="text-center q-pa-lg">
      <q-spinner color="primary" />
    </div>

    <!-- First run -->
    <q-card v-else-if="!vault.exists" flat bordered class="q-pa-md">
      <div class="lock-title">Create the vault</div>
      <p class="lock-text">
        Choose a passphrase. It is never sent to the server — passwords are
        encrypted in your browser and only ciphertext is stored. That also means
        <strong>there is no recovery</strong>: if the passphrase is lost, the
        stored passwords are gone. A memorable phrase of four or more random
        words is both stronger and easier to share than something like
        <code>Trojans2026!</code>.
      </p>

      <q-input
        v-model="passphrase"
        :type="showPassphrase ? 'text' : 'password'"
        label="Passphrase"
        outlined
        autocomplete="new-password"
        :error="!!passphrase && !!newPassphraseProblem"
        :error-message="newPassphraseProblem ?? ''"
      >
        <template #append>
          <q-icon
            :name="showPassphrase ? 'visibility_off' : 'visibility'"
            class="cursor-pointer"
            @click="showPassphrase = !showPassphrase"
          />
        </template>
      </q-input>

      <q-input
        v-model="confirmPassphrase"
        :type="showPassphrase ? 'text' : 'password'"
        label="Confirm passphrase"
        outlined
        class="q-mt-md"
        autocomplete="new-password"
      />

      <q-btn
        class="q-mt-md"
        unelevated
        no-caps
        color="primary"
        label="Create vault"
        :loading="vault.busy"
        :disable="!passphrase || !!newPassphraseProblem"
        @click="handleCreate"
      />
    </q-card>

    <!-- Locked -->
    <q-card v-else-if="!vault.isUnlocked" flat bordered class="q-pa-md">
      <div class="lock-title">
        <q-icon name="lock" size="20px" class="q-mr-xs" />
        Vault locked
      </div>
      <p class="lock-text">
        Enter the shared passphrase to decrypt stored passwords. Unlocking lasts
        until you lock it, log out, or reload the page.
      </p>

      <q-input
        v-model="passphrase"
        :type="showPassphrase ? 'text' : 'password'"
        label="Passphrase"
        outlined
        autocomplete="current-password"
        @keydown.enter="handleUnlock"
      >
        <template #append>
          <q-icon
            :name="showPassphrase ? 'visibility_off' : 'visibility'"
            class="cursor-pointer"
            @click="showPassphrase = !showPassphrase"
          />
        </template>
      </q-input>

      <div class="row q-gutter-sm q-mt-md">
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Unlock"
          :loading="vault.busy"
          :disable="!passphrase"
          @click="handleUnlock"
        />
        <q-btn flat no-caps label="Change passphrase" @click="rotateOpen = true" />
      </div>
    </q-card>

    <!-- Unlocked -->
    <template v-else>
      <q-input
        v-model="search"
        dense
        outlined
        clearable
        class="q-mb-md"
        placeholder="Search platform, label, username or owner"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <div v-if="vault.loading" class="text-center q-pa-lg">
        <q-spinner color="primary" />
      </div>

      <div v-else-if="filtered.length === 0" class="empty-state">
        No accounts stored yet.
      </div>

      <q-list v-else bordered separator class="rounded-borders">
        <q-expansion-item v-for="item in filtered" :key="item.id">
          <template #header>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ item.label }}</q-item-label>
              <q-item-label caption>
                {{ item.platform }}<template v-if="item.username"> · {{ item.username }}</template>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge v-if="item.twoFactor" color="positive" class="meta-badge">2FA</q-badge>
            </q-item-section>
          </template>

          <div class="q-pa-md entry">
            <div class="entry__grid">
              <div v-if="item.username">
                <span class="entry__key">Username</span>{{ item.username }}
              </div>
              <div v-if="item.owner">
                <span class="entry__key">Owner</span>{{ item.owner }}
              </div>
              <div v-if="item.recoveryEmail">
                <span class="entry__key">Recovery email</span>{{ item.recoveryEmail }}
              </div>
              <div v-if="item.twoFactor">
                <span class="entry__key">2FA</span>{{ item.twoFactor }}
              </div>
              <div v-if="item.url" class="entry__full">
                <span class="entry__key">URL</span>
                <a :href="item.url" target="_blank" rel="noopener">{{ item.url }}</a>
              </div>
              <div v-if="item.notes" class="entry__full">
                <span class="entry__key">Notes</span>{{ item.notes }}
              </div>
            </div>

            <div class="password-row">
              <span class="entry__key">Password</span>
              <code class="password-value">
                {{ revealed[item.id] ?? '••••••••••••' }}
              </code>
              <q-btn
                dense
                flat
                no-caps
                :icon="revealed[item.id] ? 'visibility_off' : 'visibility'"
                :label="revealed[item.id] ? 'Hide' : 'Reveal'"
                @click="toggleReveal(item)"
              />
              <q-btn
                dense
                flat
                no-caps
                icon="content_copy"
                label="Copy"
                @click="copyPassword(item)"
              />
            </div>

            <div v-if="item.updatedBy" class="entry__audit">
              Last updated by {{ item.updatedBy }}
            </div>

            <div class="row q-gutter-sm q-mt-md">
              <q-btn dense flat no-caps icon="edit" label="Edit" @click="openEdit(item)" />
              <q-space />
              <q-btn
                dense
                flat
                no-caps
                icon="delete"
                label="Delete"
                color="negative"
                @click="confirmDelete(item)"
              />
            </div>
          </div>
        </q-expansion-item>
      </q-list>

      <div class="q-mt-md">
        <q-btn flat dense no-caps icon="key" label="Change passphrase" @click="rotateOpen = true" />
      </div>
    </template>

    <!-- Add / edit -->
    <q-dialog v-model="editorOpen">
      <q-card class="vault-dialog">
        <q-card-section>
          <div class="lock-title">{{ editingId ? 'Edit account' : 'Add account' }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section class="q-gutter-md">
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <q-input v-model="editor.platform" label="Platform *" outlined
                hint="Instagram, Facebook, Gmail…" />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-model="editor.label" label="Label *" outlined hint="Club Instagram" />
            </div>
          </div>
          <q-input v-model="editor.username" label="Username or email" outlined />
          <q-input
            v-model="editorPassword"
            label="Password"
            outlined
            type="text"
            hint="Encrypted in your browser before it is saved"
          />
          <q-input v-model="editor.url" label="Login URL" outlined />
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <q-input v-model="editor.recoveryEmail" label="Recovery email" outlined />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-model="editor.owner" label="Owner" outlined hint="Who is responsible" />
            </div>
          </div>
          <q-input v-model="editor.twoFactor" label="2FA method" outlined
            hint="e.g. Authenticator app on Pete's phone" />
          <q-input v-model="editor.notes" type="textarea" label="Notes" outlined autogrow />
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Save"
            :loading="vault.busy"
            :disable="!editor.platform.trim() || !editor.label.trim()"
            @click="saveEditor"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Rotate passphrase -->
    <q-dialog v-model="rotateOpen">
      <q-card class="vault-dialog">
        <q-card-section>
          <div class="lock-title">Change passphrase</div>
          <p class="lock-text q-mb-none">
            Every stored password is decrypted and re-encrypted under the new
            passphrase. Do this whenever someone with access leaves — a shared
            secret cannot be revoked for one person.
          </p>
        </q-card-section>
        <q-separator />
        <q-card-section class="q-gutter-md">
          <q-input v-model="rotateCurrent" type="password" label="Current passphrase" outlined />
          <q-input
            v-model="rotateNext"
            type="password"
            label="New passphrase"
            outlined
            :error="!!rotateNext && !!rotateProblem"
            :error-message="rotateProblem ?? ''"
          />
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Re-encrypt"
            :loading="vault.busy"
            :disable="!rotateCurrent || !rotateNext || !!rotateProblem"
            @click="handleRotate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.vault-dialog {
  width: 100%;
  max-width: 560px;
}

.lock-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.3rem;
  text-transform: uppercase;
  color: var(--navy-800);
  display: flex;
  align-items: center;
}

.lock-text {
  color: var(--grey-600);
  line-height: 1.6;
  margin: 8px 0 16px;
}

.lock-text code {
  background: var(--grey-100);
  border-radius: 4px;
  padding: 1px 5px;
}

.meta-badge {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.66rem;
  font-weight: 600;
}

.entry {
  background: var(--grey-050);
}

.entry__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px 16px;
}

.entry__full {
  grid-column: 1 / -1;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.entry__key {
  display: block;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--grey-400);
}

.password-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--grey-200);
}

.password-value {
  background: #fff;
  border: 1px solid var(--grey-200);
  border-radius: 4px;
  padding: 4px 10px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.entry__audit {
  margin-top: 10px;
  font-size: 0.78rem;
  color: var(--grey-400);
}
</style>
