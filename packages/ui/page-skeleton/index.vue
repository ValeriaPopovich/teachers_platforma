<script src="./scripts/index.js" />

<template>
  <div class="ui-page-skeleton" :class="`ui-page-skeleton--${variant}`" role="status">
    <span class="sr-only">Загрузка раздела…</span>
    <UiSkeleton class="ui-page-skeleton__title" width="min(300px, 62%)" height="34" />
    <div class="ui-page-skeleton__toolbar">
      <UiSkeleton width="180" height="44" />
      <UiSkeleton width="130" height="44" />
    </div>
    <div class="ui-page-skeleton__content">
      <UiSkeleton
        v-for="index in blockCount"
        :key="index"
        class="ui-page-skeleton__block"
        height="100%"
      />
    </div>
  </div>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
