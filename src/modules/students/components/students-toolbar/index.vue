<script src="./scripts/index.js" />

<template>
  <div class="toolbar students-toolbar">
    <label class="student-search">
      <span class="sr-only">Поиск учеников</span>
      <UiInput
        id="studentSearch"
        :model-value="query"
        placeholder="Поиск по ученикам и группам..."
        @update:model-value="onSearchInput"
      />
    </label>

    <div class="student-filter" role="group" aria-label="Фильтр учеников">
      <button
        v-for="filter in filters"
        :key="filter.value"
        type="button"
        :class="filter.classes"
        :data-label="filter.label"
        :aria-pressed="filter.isActive"
        @click="onFilterButtonClick(filter.value)"
      >
        {{ filter.label }}
      </button>
    </div>

    <div class="students-toolbar-actions">
      <UiButton data-open="group" @click="openNewGroup"> + Группа </UiButton>
      <UiButton variant="primary" data-open="student" @click="openNewStudent"> + Ученик </UiButton>
    </div>
  </div>
</template>
