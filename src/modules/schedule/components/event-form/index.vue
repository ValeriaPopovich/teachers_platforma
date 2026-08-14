<script src="./scripts/index.js" />

<template>
  <UiModal
    :open="eventFormUi.open"
    :title="modalTitle"
    title-id="eventModalTitle"
    wrap-class="ui-modal-wrap--side"
    content-class="event-form-modal"
    :should-confirm-close="shouldConfirmClose"
    @close="onModalClose"
  >
    <EventFormBody
      :event="event"
      :default-date="eventFormUi.date"
      :default-duration="eventFormUi.duration"
      @close-request="onModalClose"
      @dirty-change="dirty = $event"
    />
  </UiModal>
</template>

<style lang="scss">
@use '../../../../../styles/tokens/breakpoints' as bp;

@include bp.from(bp.$layout-desktop + 1) {
  .ui-modal-wrap--side:has(.event-form-modal) {
    align-items: flex-start;
    padding: 16px;
  }

  .ui-modal-wrap--side:has(.event-form-modal) .modal {
    height: auto;
    max-height: calc(100dvh - 32px);
    border-radius: 24px;
  }
}
</style>
