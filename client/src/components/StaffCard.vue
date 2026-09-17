<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { StaffMember } from 'src/types'

/**
 * One coach, with the bio clamped to keep the grid even.
 *
 * The card only becomes clickable when the clamp is actually hiding something.
 * A card whose bio fits has nothing more to show, and offering a modal that
 * reproduces what is already on screen teaches people that clicking these does
 * nothing worth doing.
 */

defineProps<{ member: StaffMember }>()

const emit = defineEmits<{ (e: 'open'): void }>()

const bio = ref<HTMLElement | null>(null)
const truncated = ref(false)

/**
 * Measured, not guessed from the character count.
 *
 * The clamp is by line, and how many lines a bio takes depends on the card
 * width and the font. A length threshold would hide the end of a long bio on a
 * narrow phone while calling a wrapped short one complete.
 */
function measure() {
  const el = bio.value
  if (!el) {
    truncated.value = false
    return
  }
  // A pixel of tolerance: sub-pixel line heights otherwise report every bio as
  // overflowing by a fraction.
  truncated.value = el.scrollHeight - el.clientHeight > 1
}

let observer: ResizeObserver | null = null

onMounted(() => {
  measure()
  // Re-measured on resize, because the same bio clamps on a phone and fits on
  // a desktop, and the card is in a two-column grid that changes at sm.
  if (typeof ResizeObserver !== 'undefined' && bio.value) {
    observer = new ResizeObserver(measure)
    observer.observe(bio.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <!-- card-interactive is the shared hover lift, applied only when there is
       something to open. On a card that is already showing its whole bio the
       lift would be an invitation to click something that does nothing. -->
  <q-card
    flat
    bordered
    class="staff-card"
    :class="{ 'staff-card--clickable card-interactive': truncated }"
    @click="truncated && emit('open')"
  >
    <q-card-section>
      <div class="staff-card__role">{{ member.role }}</div>
      <h2 class="staff-card__name">
        {{ member.firstName }} {{ member.lastName }}
      </h2>

      <p
        v-if="member.bio"
        ref="bio"
        class="staff-card__bio"
      >{{ member.bio }}</p>

      <!-- A real button rather than relying on the card's own click, so this is
           reachable by keyboard. The card click is a convenience on top of it.
           The whole card is not given a button role because it contains the
           email link, and an interactive element inside another one is
           ambiguous to a screen reader. -->
      <button
        v-if="truncated"
        type="button"
        class="staff-card__more"
        :aria-label="`Read ${member.firstName} ${member.lastName}'s full bio`"
        @click.stop="emit('open')"
      >
        Read full bio
      </button>

      <a
        v-if="member.email"
        :href="`mailto:${member.email}`"
        class="staff-card__email"
        @click.stop
      >{{ member.email }}</a>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.staff-card {
  height: 100%;
}

.staff-card--clickable {
  cursor: pointer;
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

  /* Four lines keeps a row of cards even without cutting most bios short. */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  overflow: hidden;
}

.staff-card__more {
  appearance: none;
  display: block;
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--navy-800);
  cursor: pointer;
  text-decoration: underline;
}

.staff-card__email {
  display: inline-block;
  margin-top: 10px;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}
</style>
