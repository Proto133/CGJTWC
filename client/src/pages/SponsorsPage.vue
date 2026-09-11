<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useMeta } from 'quasar'
import { useSponsorsStore } from 'stores/sponsors'
import { useSettingsStore } from 'stores/settings'
import {
  activeSponsors,
  cardBackground,
  groupByTier,
  hasLiveOffer,
  isSafeUrl,
  safeSocials,
  showTierHeadings,
} from 'src/utils/sponsors'
import type { Sponsor, SponsorSocials } from 'src/types'

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
 * One dialog for the whole page, driven by whichever tile was opened.
 *
 * A dialog per card would put every sponsor's markup in the DOM permanently
 * for the sake of one that is visible at a time.
 */
const selected = ref<Sponsor | null>(null)
const detailOpen = ref(false)

function openDetails(sponsor: Sponsor) {
  selected.value = sponsor
  detailOpen.value = true
}

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

/**
 * The offer disclaimer, shown only when there is an offer to disclaim.
 *
 * Dismissal is remembered, and the key carries a version: changing the wording
 * means bumping it, so people who dismissed the old text are shown the new one
 * rather than never seeing it.
 */
const NOTICE_KEY = 'sponsor-offer-notice-v1'
const noticeDismissed = ref(false)

onMounted(() => {
  try {
    noticeDismissed.value = localStorage.getItem(NOTICE_KEY) === '1'
  } catch {
    // Private browsing can throw on access. Showing the notice is the safe
    // failure here, so nothing else is needed.
  }
})

function dismissNotice() {
  noticeDismissed.value = true
  try {
    localStorage.setItem(NOTICE_KEY, '1')
  } catch {
    // Dismissal simply will not persist; the banner stays closed for this view.
  }
}

const anyOffers = computed(() =>
  activeSponsors(sponsorsStore.sponsors).some((s) => hasLiveOffer(s)))

/** Extra links, re-filtered at render in case an older document predates the rule. */
function extraLinks(sponsor: Sponsor) {
  return (sponsor.links ?? []).filter((l) => isSafeUrl(l.url))
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

      <!-- Only appears when somebody actually has an offer, and stays dismissed
           once closed. The same point is repeated beside each offer in the
           dialog, so dismissing this does not leave a claim unqualified. -->
      <q-banner
        v-if="anyOffers && !noticeDismissed"
        dense
        rounded
        class="offer-notice"
      >
        <template #avatar>
          <q-icon name="info" color="primary" size="20px" />
        </template>
        Offers on this page are set and honoured by the business, not by the
        club. They may change or be withdrawn at the business's discretion, and
        the club is not responsible for whether one is applied.
        <template #action>
          <q-btn flat dense no-caps label="Got it" @click="dismissNotice" />
        </template>
      </q-banner>

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

          <div class="sponsor-grid" :class="`sponsor-grid--${group.tier}`">
            <!-- A real button, not a div with a click handler: that buys
                 keyboard access, Enter and Space, and focus styling for free,
                 which a flip-on-hover card would have had to reimplement. -->
            <button
              v-for="sponsor in group.sponsors"
              :key="sponsor.id"
              type="button"
              class="sponsor-tile"
              :class="`sponsor-tile--${sponsor.tier}`"
              :style="{ backgroundImage: cardBackground(sponsor) ?? undefined }"
              :aria-label="`${sponsor.name} — sponsor details`"
              @click="openDetails(sponsor)"
            >
              <div class="sponsor-tile__logo">
                <img
                  v-if="isSafeUrl(sponsor.logoUrl)"
                  :src="sponsor.logoUrl"
                  alt=""
                  loading="lazy"
                />
                <span v-else class="sponsor-tile__fallback">{{ sponsor.name }}</span>
              </div>

              <!-- Kept even though the tile is logo-led: plenty of logos are a
                   symbol with no wordmark, and a wall of unidentifiable marks
                   helps nobody. It also gives the tile a visible affordance. -->
              <div class="sponsor-tile__name">{{ sponsor.name }}</div>
              <div v-if="hasLiveOffer(sponsor)" class="sponsor-tile__offer">
                <q-icon name="local_offer" size="13px" />
                Club offer
              </div>
              <div v-else class="sponsor-tile__more">Details</div>
            </button>
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

    <q-dialog v-model="detailOpen">
      <q-card v-if="selected" class="detail-card">
        <div
          class="detail-card__head"
          :style="{ backgroundImage: cardBackground(selected) ?? undefined }"
        >
          <div v-if="isSafeUrl(selected.logoUrl)" class="detail-card__logo">
            <img :src="selected.logoUrl" :alt="selected.name" />
          </div>
          <h2 class="detail-card__name">{{ selected.name }}</h2>
        </div>

        <q-card-section>
          <div v-if="hasLiveOffer(selected)" class="detail-offer">
            <div class="detail-offer__head">
              <q-icon name="local_offer" size="16px" />
              Offer for club families
            </div>
            <p class="detail-offer__text">{{ selected.offer }}</p>
            <p v-if="selected.offerCode" class="detail-offer__code">
              Mention <strong>{{ selected.offerCode }}</strong>
            </p>
            <!-- Repeated here rather than relying on the banner alone, which is
                 dismissible: the qualification belongs next to the claim. -->
            <p class="detail-offer__small">
              Offered and honoured by {{ selected.name }}, not by the club, and
              subject to change at their discretion.
            </p>
          </div>

          <p v-if="selected.blurb" class="detail-card__blurb">{{ selected.blurb }}</p>

          <div class="detail-card__links">
            <!-- noopener so the target page cannot reach back through
                 window.opener; noreferrer on every outbound link. -->
            <a
              v-if="isSafeUrl(selected.websiteUrl)"
              :href="selected.websiteUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="sponsor-link"
            >
              <q-icon name="public" size="16px" />
              Website
            </a>
            <a v-if="selected.phone" :href="telHref(selected.phone)" class="sponsor-link">
              <q-icon name="call" size="16px" />
              {{ selected.phone }}
            </a>
            <a
              v-for="social in safeSocials(selected.socials)"
              :key="social.key"
              :href="social.url"
              target="_blank"
              rel="noopener noreferrer"
              class="sponsor-link"
            >
              <q-icon name="open_in_new" size="16px" />
              {{ SOCIAL_LABELS[social.key] }}
            </a>
            <a
              v-for="link in extraLinks(selected)"
              :key="link.url"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="sponsor-link"
            >
              <q-icon name="arrow_forward" size="16px" />
              {{ link.label }}
            </a>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Close" />
        </q-card-actions>
      </q-card>
    </q-dialog>
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
  gap: 14px;
  /* auto-fill rather than auto-fit: auto-fit collapses empty tracks and would
     stretch a single tile across the whole row. */
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.sponsor-grid--gold {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.sponsor-grid--bronze {
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
}

.sponsor-tile {
  /* Resetting the button's own chrome; everything visual is below. */
  appearance: none;
  font: inherit;
  text-align: center;
  cursor: pointer;

  border: 1px solid var(--grey-200);
  border-radius: var(--radius-md);
  background-color: #fff;
  padding: 16px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

/* Pointer devices only: :hover sticks after a tap on touch screens. */
@media (hover: hover) and (pointer: fine) {
  .sponsor-tile:hover {
    border-color: var(--navy-700);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 21, 61, 0.08));
  }
}

.sponsor-tile:focus-visible {
  outline: 3px solid var(--navy-700);
  outline-offset: 2px;
}

.sponsor-tile__logo {
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sponsor-tile--bronze .sponsor-tile__logo {
  height: 64px;
}

.sponsor-tile__logo img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.sponsor-tile__fallback {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--navy-800);
  line-height: 1.15;
}

.sponsor-tile__name {
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--navy-800);
  overflow-wrap: break-word;
}

.sponsor-tile--bronze .sponsor-tile__name {
  font-size: 0.85rem;
}

.sponsor-tile__more {
  font-size: 0.74rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--grey-500);
}

/* Replaces the "Details" line rather than joining it, so the tile keeps a
   single call to action instead of two competing ones. */
.sponsor-tile__offer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  align-self: center;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--navy-800);
  background: var(--grey-100);
  border: 1px solid var(--grey-300);
  border-radius: 999px;
  padding: 2px 10px;
}

.offer-notice {
  margin-bottom: 18px;
  background: var(--grey-050);
  border: 1px solid var(--grey-200);
  font-size: 0.86rem;
  line-height: 1.55;
  color: var(--grey-600);
}

.detail-offer {
  border: 1px solid var(--grey-300);
  border-left: 4px solid var(--navy-800);
  border-radius: var(--radius-sm);
  background: var(--grey-050);
  padding: 12px 14px;
  margin-bottom: 14px;
}

.detail-offer__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--navy-800);
}

.detail-offer__text {
  margin: 6px 0 0;
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--grey-900);
  white-space: pre-wrap;
}

.detail-offer__code {
  margin: 6px 0 0;
  font-size: 0.9rem;
  color: var(--navy-800);
}

.detail-offer__small {
  margin: 8px 0 0;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--grey-500);
}

/* Dialog ---------------------------------------------------------------- */

.detail-card {
  width: 460px;
  max-width: 94vw;
}

.detail-card__head {
  background-color: #fff;
  padding: 22px 20px 16px;
  text-align: center;
  border-bottom: 1px solid var(--grey-200);
}

.detail-card__logo {
  height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.detail-card__logo img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.detail-card__name {
  font-size: 1.25rem;
  margin: 0;
  overflow-wrap: break-word;
}

.detail-card__blurb {
  margin: 0 0 14px;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--grey-600);
  /* Sponsor-supplied copy, so it is rendered as text and never as markup. */
  white-space: pre-wrap;
}

.detail-card__links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.sponsor-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.9rem;
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
