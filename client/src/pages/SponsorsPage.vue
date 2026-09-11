<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useMeta } from 'quasar'
import { useSponsorsStore } from 'stores/sponsors'
import { useSettingsStore } from 'stores/settings'
import {
  activeSponsors,
  groupByTier,
  isSafeUrl,
  safeSocials,
  showTierHeadings,
} from 'src/utils/sponsors'
import type { SponsorSocials } from 'src/types'

const sponsorsStore = useSponsorsStore()
const settings = useSettingsStore()
const org = computed(() => settings.org)

onMounted(() => {
  sponsorsStore.subscribe()
})

onUnmounted(() => {
  sponsorsStore.unsubscribeFromSponsors()
})

const groups = computed(() => groupByTier(activeSponsors(sponsorsStore.sponsors)))

/**
 * Headings only earn their space once there is more than one tier on show.
 *
 * The club is launching with a single sponsor. A lone "Gold" banner above one
 * logo reads as an unfinished page rather than an aspirational one.
 */
const withHeadings = computed(() => showTierHeadings(groups.value))

const total = computed(() =>
  groups.value.reduce((sum, group) => sum + group.sponsors.length, 0))

/**
 * Displayed as typed, dialled as digits.
 *
 * The scheme is hardcoded rather than interpolated from input, and everything
 * but digits and a leading plus is stripped, so no admin entry can turn this
 * into some other kind of link.
 */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

/** Material Icons carries no brand glyphs, so these are labelled links. */
const SOCIAL_LABELS: Record<keyof SponsorSocials, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  linkedin: 'LinkedIn',
}

useMeta(() => ({
  title: `Sponsors · ${org.value.identity.name}`,
}))
</script>

<template>
  <q-page>
    <div class="page-shell page-shell--mid">
      <header class="page-header">
        <div class="eyebrow">Our Supporters</div>
        <h1 class="page-title">Sponsors</h1>
        <p class="lead">
          These businesses keep the club running. Please support the people who
          support our wrestlers.
        </p>
      </header>

      <div v-if="sponsorsStore.loading" class="text-center q-pa-xl">
        <q-spinner color="primary" size="lg" />
      </div>

      <div v-else-if="total === 0" class="empty-state">
        Our sponsor lineup for the season is coming together — check back soon.
      </div>

      <!-- v-for lives inside the v-else rather than beside it: Vue resolves
           v-if before v-for on the same element, so the two together would not
           mean what they read as. -->
      <template v-else>
        <section v-for="group in groups" :key="group.tier" class="tier">
          <h2 v-if="withHeadings" class="tier__label">{{ group.label }}</h2>

          <!-- The grid is capped rather than stretched: one sponsor on a wide
               screen should look deliberate, not stranded across the viewport. -->
          <div class="sponsor-grid" :class="`sponsor-grid--${group.tier}`">
            <article
              v-for="sponsor in group.sponsors"
              :key="sponsor.id"
              class="sponsor-card"
              :class="`sponsor-card--${sponsor.tier}`"
            >
              <!-- Fixed box with contain: sponsor logos arrive in wildly
                   different aspect ratios and a naive grid looks broken at once. -->
              <div v-if="isSafeUrl(sponsor.logoUrl)" class="sponsor-card__logo">
                <img :src="sponsor.logoUrl" :alt="sponsor.name" loading="lazy" />
              </div>

              <h3 class="sponsor-card__name">{{ sponsor.name }}</h3>

              <p v-if="sponsor.blurb" class="sponsor-card__blurb">{{ sponsor.blurb }}</p>

              <div class="sponsor-card__links">
                <!-- noopener so the target page cannot reach back through
                     window.opener; noreferrer on every outbound link. -->
                <a
                  v-if="isSafeUrl(sponsor.websiteUrl)"
                  :href="sponsor.websiteUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="sponsor-link"
                >
                  <q-icon name="public" size="15px" />
                  Website
                </a>
                <a
                  v-if="sponsor.phone"
                  :href="telHref(sponsor.phone)"
                  class="sponsor-link"
                >
                  <q-icon name="call" size="15px" />
                  {{ sponsor.phone }}
                </a>
                <a
                  v-for="social in safeSocials(sponsor.socials)"
                  :key="social.key"
                  :href="social.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="sponsor-link"
                >
                  <q-icon name="open_in_new" size="15px" />
                  {{ SOCIAL_LABELS[social.key] }}
                </a>
              </div>
            </article>
          </div>
        </section>
      </template>

      <!-- With one sponsor and nine to find, the enquiry route is the most
           valuable thing on this page. A sponsorship page nobody can act on is
           decoration. -->
      <aside class="sponsor-cta">
        <div>
          <div class="sponsor-cta__title">Interested in sponsoring?</div>
          <p class="sponsor-cta__text">
            Sponsorship keeps mat time affordable for local families, and puts
            your business in front of the club all season.
          </p>
        </div>
        <q-btn
          to="/contact"
          label="Get in touch"
          color="primary"
          unelevated
          no-caps
          class="sponsor-cta__btn"
        />
      </aside>
    </div>
  </q-page>
</template>

<style scoped>
.tier {
  margin-top: 28px;
}

.tier__label {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--navy-800);
  margin: 0 0 12px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--grey-200);
}

.sponsor-grid {
  display: grid;
  gap: 16px;
  /* auto-fill rather than auto-fit: auto-fit collapses empty tracks and would
     stretch a single card across the whole row. */
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

.sponsor-grid--gold {
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.sponsor-grid--bronze {
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
}

.sponsor-card {
  border: 1px solid var(--grey-200);
  border-radius: var(--radius-md);
  background: #fff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sponsor-card--gold {
  border-color: var(--grey-300);
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 21, 61, 0.06));
}

.sponsor-card__logo {
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sponsor-card--bronze .sponsor-card__logo {
  height: 64px;
}

.sponsor-card__logo img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.sponsor-card__name {
  font-size: 1.05rem;
  margin: 0;
  overflow-wrap: break-word;
}

.sponsor-card--bronze .sponsor-card__name {
  font-size: 0.95rem;
}

.sponsor-card__blurb {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--grey-600);
  /* Sponsor-supplied copy, so it is rendered as text and never as markup. */
  white-space: pre-wrap;
}

.sponsor-card--bronze .sponsor-card__blurb {
  font-size: 0.84rem;
}

.sponsor-card__links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: auto;
  padding-top: 4px;
}

.sponsor-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.84rem;
  color: var(--navy-800);
  text-decoration: none;
}

.sponsor-link:hover {
  text-decoration: underline;
}

.sponsor-cta {
  margin-top: 36px;
  padding: 18px;
  border: 1px solid var(--grey-200);
  border-radius: var(--radius-md);
  background: var(--grey-050);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.sponsor-cta__title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  text-transform: uppercase;
  color: var(--navy-800);
}

.sponsor-cta__text {
  margin: 4px 0 0;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--grey-600);
  max-width: 46ch;
}

.sponsor-cta__btn {
  flex: 0 0 auto;
}
</style>
