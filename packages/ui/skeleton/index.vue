<script src="./scripts/index.js" />

<template>
  <span
    class="ui-skeleton"
    :class="`ui-skeleton--${shape}`"
    :style="skeletonStyle"
    aria-hidden="true"
  ></span>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
