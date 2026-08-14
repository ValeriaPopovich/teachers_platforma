<script src="./scripts/index.js" />

<template>
  <Transition
    name="ui-collapse"
    @before-enter="beforeEnter"
    @enter="enter"
    @after-enter="afterEnter"
    @before-leave="beforeLeave"
    @leave="leave"
  >
    <div v-if="open" class="ui-collapse"><slot /></div>
  </Transition>
</template>

<style scoped lang="scss">
.ui-collapse {
  transition:
    height 220ms cubic-bezier(0.2, 0.75, 0.25, 1),
    opacity 180ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .ui-collapse {
    transition: none;
  }
}
</style>
