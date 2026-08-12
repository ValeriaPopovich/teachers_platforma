<script src="./scripts/index.js" />

<template>
  <UiPageLayout class="dashboard-page">
    <template #header
      ><header class="dashboard-page__topbar">
        <h1 class="dashboard-page__title">{{ model.dayTitle }}</h1>
        <div class="dashboard-page__actions">
          <UiButton variant="secondary">⚡ Быстро</UiButton>
          <UiButton variant="primary" data-open="lesson">＋ Занятие</UiButton>
          <UiButton variant="secondary" class="dashboard-page__bell" aria-label="Уведомления">
            🔔
          </UiButton>
        </div>
      </header></template
    >

    <section class="dashboard-page__top-row">
      <DaySummary :progress="model.progress" :income="model.income" :stats-label="statsLabel" />
      <AttentionPanel :items="model.attention" />
    </section>

    <DayTimeline :timeline="model.timeline" :next="model.next" />
  </UiPageLayout>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
