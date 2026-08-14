<script src="./scripts/index.js" />

<template>
  <component
    :is="isMobile ? 'UiBottomSheet' : 'UiModal'"
    :open="open"
    title="Добавить событие"
    wrap-class="ui-modal-wrap--side"
    content-class="schedule-create-sheet__modal"
    @close="close"
  >
    <div class="schedule-create-sheet__actions">
      <UiButton
        type="button"
        variant="primary"
        size="lg"
        block
        class="schedule-create-sheet__action is-lesson"
        @click="select('lesson')"
      >
        <span>Занятие</span><span aria-hidden="true">↗</span>
      </UiButton>
      <UiButton
        type="button"
        variant="secondary"
        size="lg"
        block
        class="schedule-create-sheet__action is-event"
        @click="select('event')"
      >
        <span>Дело</span><span aria-hidden="true">↗</span>
      </UiButton>
    </div>
  </component>
</template>

<style scoped src="./styles/index.scss" lang="scss" />

<style lang="scss">
@use '../../../../../styles/tokens/breakpoints' as bp;

@include bp.from(bp.$layout-desktop + 1) {
  .ui-modal-wrap--side:has(.schedule-create-sheet__modal) {
    align-items: flex-start;
    padding: 16px;
  }

  .ui-modal-wrap--side:has(.schedule-create-sheet__modal) .modal {
    width: min(460px, calc(100vw - 32px));
    height: auto;
    max-height: calc(100dvh - 32px);
    border-radius: 24px;
  }

  // Shared view-transition name — browser morphs bounds + cross-fades content
  // between the choice sheet and the lesson/event form on desktop.
  .schedule-create-sheet__modal,
  .lesson-form-modal,
  .event-form-modal {
    view-transition-name: schedule-side-panel;
  }
}

::view-transition-group(schedule-side-panel) {
  animation-duration: 320ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

::view-transition-old(schedule-side-panel),
::view-transition-new(schedule-side-panel) {
  animation-duration: 220ms;
}
</style>
