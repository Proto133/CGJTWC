<script setup lang="ts">
import { computed } from 'vue'
import { useMeta } from 'quasar'
import { useSettingsStore } from 'stores/settings'

const settings = useSettingsStore()
const org = computed(() => settings.org)

/** Blank entries are skipped so a half-filled row never renders an empty panel. */
const faqs = computed(() =>
  (org.value.content.faqs ?? []).filter(
    (item) => item.question.trim() !== '' && item.answer.trim() !== '',
  ))

useMeta(() => ({
  title: `FAQ · ${org.value.identity.name}`,
}))
</script>

<template>
  <q-page>
    <div class="page-shell page-shell--narrow">
      <header class="page-header">
        <div class="eyebrow">Good to Know</div>
        <h1 class="page-title">Frequently Asked Questions</h1>
        <p v-if="org.content.faqIntro" class="lead">{{ org.content.faqIntro }}</p>
      </header>

      <!-- Accordion rather than a wall of text: most visitors want one answer,
           and on a phone a long page of open answers is hard to scan. -->
      <q-list v-if="faqs.length" bordered separator class="rounded-borders">
        <q-expansion-item
          v-for="item in faqs"
          :key="item.id"
          :label="item.question"
          header-class="faq__question"
        >
          <div class="faq__answer">{{ item.answer }}</div>
        </q-expansion-item>
      </q-list>

      <div v-else class="empty-state">
        We have not published any questions yet. In the meantime, please
        <router-link to="/contact">get in touch</router-link> and we will help.
      </div>

      <section class="section text-center">
        <p class="faq__cta-text">Still have a question?</p>
        <q-btn
          to="/contact"
          label="Contact us"
          color="primary"
          unelevated
          no-caps
          size="lg"
        />
      </section>
    </div>
  </q-page>
</template>

<style scoped>
.faq__question {
  font-weight: 600;
}

.faq__answer {
  padding: 0 16px 16px;
  line-height: 1.65;
  color: var(--grey-600);
  /* Answers are authored in a textarea, so newlines are meaningful. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.faq__cta-text {
  color: var(--grey-600);
  margin-bottom: 12px;
}
</style>
