<script src="./scripts/index.js" />

<template>
  <div class="toolbar students-toolbar">
    <label class="student-search">
      <span class="sr-only">Поиск учеников</span>
      <UiInput id="studentSearch" v-model="query" placeholder="Поиск по ученикам и группам..." />
    </label>

    <div id="studentFilter" class="student-filter" role="group" aria-label="Фильтр учеников">
      <button
        v-for="filter in filters"
        :key="filter.value"
        type="button"
        :class="filter.classes"
        :data-student-filter="filter.value"
        :aria-pressed="filter.isActive"
        @click="onFilterButtonClick(filter.value)"
      >
        {{ filter.label }}
      </button>
    </div>

    <div class="students-toolbar-actions">
      <UiButton data-open="group">
        <template #iconBefore><UiIcon name="user-plus" /></template>
        + Группа
      </UiButton>
      <UiButton variant="primary" data-open="student">
        <template #iconBefore><UiIcon name="user-plus" /></template>
        + Ученик
      </UiButton>
    </div>
  </div>
</template>
