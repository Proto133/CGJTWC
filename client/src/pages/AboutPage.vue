<script setup lang="ts">
</script>

<template>
  <q-page>
    <div class="page-shell page-shell--narrow">
      <header class="page-header">
        <div class="eyebrow">Our Program</div>
        <h1 class="page-title">About the Club</h1>
        <p class="lead">
          The Trojans Wrestling Club serves young athletes in the Cary Grove area. Our mission is to
          teach the fundamentals of wrestling while instilling discipline, respect, hard work and
          teamwork.
        </p>
      </header>

      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-6 col-sm-3">
          <div class="stat-tile">
            <div class="stat-tile__value">K–8</div>
            <div class="stat-tile__label">Grades</div>
          </div>
        </div>
        <div class="col-6 col-sm-3">
          <div class="stat-tile">
            <div class="stat-tile__value">All</div>
            <div class="stat-tile__label">Skill levels</div>
          </div>
        </div>
        <div class="col-6 col-sm-3">
          <div class="stat-tile">
            <div class="stat-tile__value">Cary</div>
            <div class="stat-tile__label">Illinois</div>
          </div>
        </div>
        <div class="col-6 col-sm-3">
          <div class="stat-tile">
            <div class="stat-tile__value">Nov–Feb</div>
            <div class="stat-tile__label">Season</div>
          </div>
        </div>
      </div>

      <section class="section">
        <h2 class="section-title">What We Offer</h2>
        <ul class="feature-list q-mt-md">
          <li>Age-appropriate training for elementary and middle school wrestlers</li>
          <li>Experienced volunteer coaches focused on safety and development</li>
          <li>Participation in local dual meets and tournaments</li>
          <li>A positive, supportive environment for beginners and experienced wrestlers alike</li>
        </ul>
      </section>

      <section class="section">
        <h2 class="section-title">Our Values</h2>
        <p class="q-mt-md">
          Every wrestler matters. We emphasize effort over outcome and personal growth over trophies.
          Parents and families are an essential part of our team.
        </p>
      </section>

      <div class="section">
        <q-btn to="/contact" label="Get Involved" color="primary" unelevated no-caps size="lg" />
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.stat-tile__value {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.45rem;
  text-transform: uppercase;
  color: var(--navy-800);
  line-height: 1;
}

.stat-tile__label {
  font-size: 0.74rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--grey-400);
  margin-top: 6px;
}

.feature-list {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--grey-600);
}

.feature-list li {
  margin-bottom: 8px;
  line-height: 1.6;
}
</style>
