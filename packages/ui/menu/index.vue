<script src="./scripts/index.js" />

<template>
  <div ref="root" class="ui-menu" :data-menu-owner="ownerId">
    <button
      class="ui-menu-trigger"
      type="button"
      :aria-label="ariaLabel"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      @click="toggle"
    >
      <slot name="trigger">•••</slot>
    </button>
    <div v-if="isOpen" class="ui-menu-panel" role="menu" @click="close">
      <button
        v-for="item in items"
        :key="item.value"
        class="ui-menu-item"
        :class="itemClass(item)"
        type="button"
        role="menuitem"
        :data-menu-action="item.value"
        :data-menu-owner="ownerId"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
