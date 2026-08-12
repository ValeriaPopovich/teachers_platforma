<script src="./scripts/index.js" />

<template>
  <span
    ref="trigger"
    class="ui-tooltip-trigger"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
  </span>
  <Teleport to="body">
    <Transition name="ui-tooltip">
      <span
        v-if="isVisible"
        :id="tooltipId"
        class="ui-tooltip"
        role="tooltip"
        :style="tooltipStyle"
      >
        {{ text }}
      </span>
    </Transition>
  </Teleport>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
