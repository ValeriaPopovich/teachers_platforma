<script src="./scripts/index.js" />

<template>
  <UiBottomSheet :open="open" title="Добавить событие" @close="close">
    <div class="schedule-create-sheet__actions">
      <button
        type="button"
        class="schedule-create-sheet__action is-lesson"
        @click="select('lesson')"
      >
        <span>Занятие</span><span aria-hidden="true">↗</span>
      </button>
      <button type="button" class="schedule-create-sheet__action is-event" @click="select('event')">
        <span>Дело</span><span aria-hidden="true">↗</span>
      </button>
    </div>
  </UiBottomSheet>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
