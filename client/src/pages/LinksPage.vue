<script setup lang="ts">
import { computed } from 'vue'
import { useMeta } from 'quasar'
import { useSettingsStore } from 'stores/settings'

const settings = useSettingsStore()
const org = computed(() => settings.org)

/**
 * Only http(s) links are rendered.
 *
 * These come from admin-editable settings and go straight into an href, so a
 * `javascript:` or `data:` URL would execute in a visitor's browser. Filtering
 * here rather than trusting the input keeps that impossible even if an admin
 * account is compromised. Entries missing a label or URL are skipped too, so a
 * half-finished row is harmless.
 */
const links = computed(() =>
  (org.value.content.links ?? []).filter(
    (item) =>
      item.label.trim() !== ''
      && /^https?:\/\//i.test(item.url.trim()),
  ))

/** "usawmembership.com" — shown so people can see where they are going. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

useMeta(() => ({
  title: `Resources · ${org.value.identity.name}`,
}))
</script>

<template>
  <q-page>
    <div class="page-shell page-shell--narrow">
      <header class="page-header">
        <div class="eyebrow">Useful Links</div>
        <h1 class="page-title">Resources</h1>
        <p v-if="org.content.linksIntro" class="lead">{{ org.content.linksIntro }}</p>
      </header>

      <div v-if="links.length" class="link-list">
        <!-- noopener and noreferrer on every outbound link: without noopener the
             target page can reach back through window.opener. -->
        <a
          v-for="item in links"
          :key="item.id"
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
          class="link-card"
        >
          <div class="link-card__body">
            <div class="link-card__label">
              {{ item.label }}
              <q-icon name="open_in_new" size="15px" class="link-card__icon" />
            </div>
            <div v-if="item.description" class="link-card__desc">
              {{ item.description }}
            </div>
            <div class="link-card__host">{{ hostOf(item.url) }}</div>
          </div>
        </a>
      </div>

      <div v-else class="empty-state">
        No links have been added yet.
      </div>

      <p class="link-note">
        These sites are run by other organisations. We cannot reset passwords or
        fix sign-in problems on them, but a coach can usually point you in the
        right direction.
      </p>
    </div>
  </q-page>
</template>

<style scoped>
.link-list {
  display: grid;
  gap: 10px;
}

.link-card {
  display: block;
  border: 1px solid var(--grey-200, #e5e7eb);
  border-radius: var(--radius-md, 10px);
  background: #fff;
  padding: 14px 16px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

/* Pointer devices only: :hover sticks after a tap on touch screens. */
@media (hover: hover) and (pointer: fine) {
  .link-card:hover {
    border-color: var(--navy-700, #1d4ed8);
    transform: translateY(-1px);
  }
}

.link-card__label {
  font-weight: 600;
  color: var(--navy-800);
}

.link-card__icon {
  color: var(--grey-400);
  vertical-align: baseline;
}

.link-card__desc {
  margin-top: 3px;
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--grey-600);
}

.link-card__host {
  margin-top: 6px;
  font-size: 0.78rem;
  color: var(--grey-400);
}

.link-note {
  margin-top: 20px;
  font-size: 0.86rem;
  color: var(--grey-500);
}
</style>
