<script src="./scripts/index.js" />

<template>
  <UiPageLayout class="dashboard-page">
    <template #header
      ><header class="dashboard-page__topbar">
        <h1 class="dashboard-page__title">{{ model.dayTitle }}</h1>
        <div class="dashboard-page__actions">
          <UiButton
            v-if="hasStudents"
            variant="primary"
            data-open="lesson"
            @click="onAddLessonButtonClick"
            ><template #iconBefore><UiIcon name="plus" :size="18" /></template>Занятие</UiButton
          >
          <UiButton
            v-if="hasStudents"
            variant="secondary"
            data-open="student"
            @click="openNewStudent"
            ><template #iconBefore><UiIcon name="plus" :size="18" /></template>Ученик</UiButton
          >
          <UiButton v-else variant="primary" data-open="student" @click="openNewStudent"
            ><template #iconBefore><UiIcon name="plus" :size="18" /></template>Ученик</UiButton
          >
        </div>
      </header></template
    >

    <UiEmptyState
      v-if="!hasStudents"
      title="Начните с первого ученика"
      description="После этого можно будет добавить занятие, настроить расписание и вести оплаты."
    >
      <template #action>
        <UiButton variant="primary" @click="openNewStudent">+ Добавить ученика</UiButton>
      </template>
    </UiEmptyState>
    <div v-else class="dashboard-page__content">
      <div class="dashboard-page__primary">
        <DaySummary
          class="dashboard-page__summary"
          :progress="model.progress"
          :income="model.income"
          :stats-label="statsLabel"
        />
        <DayTimeline
          class="dashboard-page__timeline"
          :timeline="model.timeline"
          :next="model.next"
        />
      </div>
      <AttentionPanel class="dashboard-page__attention" :items="model.attention" />
    </div>
  </UiPageLayout>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
