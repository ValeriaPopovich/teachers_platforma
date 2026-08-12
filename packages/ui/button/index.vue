<script src="./scripts/index.js" />

<template>
  <component
    :is="component"
    class="btn ui-button"
    :class="buttonClasses"
    v-bind="componentAttributes"
    @click="onButtonClick"
  >
    <span v-if="hasIconBefore" class="ui-button__icon" aria-hidden="true">
      <slot name="iconBefore" />
    </span>
    <span class="ui-button__content"><slot /></span>
    <span v-if="loading" class="ui-button__loader" aria-hidden="true"></span>
    <span v-if="hasIconAfter" class="ui-button__icon" aria-hidden="true">
      <slot name="iconAfter" />
    </span>
  </component>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
