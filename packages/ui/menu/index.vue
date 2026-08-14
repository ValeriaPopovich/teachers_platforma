<script src="./scripts/index.js" />

<template>
  <div ref="root" class="ui-menu">
    <button
      class="ui-menu-trigger text-foreground hover:bg-muted aria-expanded:bg-muted"
      type="button"
      :aria-label="ariaLabel"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      @click="toggle"
    >
      <slot name="trigger">•••</slot>
    </button>
    <div v-if="isOpen" class="ui-menu-panel border border-border bg-card" role="menu">
      <button
        v-for="item in items"
        :key="item.value"
        class="ui-menu-item text-foreground hover:bg-muted focus-visible:bg-muted"
        :class="itemClass(item)"
        type="button"
        role="menuitem"
        @click="onItemClick(item)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
