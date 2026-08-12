<script src="./scripts/index.js" />

<template>
  <div class="ui-page-layout" :class="{ 'ui-page-layout--aside': $slots.aside }">
    <header v-if="$slots.header" class="ui-page-layout__header"><slot name="header" /></header>
    <main class="ui-page-layout__content"><slot /></main>
    <aside v-if="$slots.aside" class="ui-page-layout__aside"><slot name="aside" /></aside>
  </div>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
