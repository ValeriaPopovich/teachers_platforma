<script src="./scripts/index.js" />

<template>
  <section class="ui-empty-state" :class="{ 'ui-empty-state--compact': compact }">
    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.action" class="ui-empty-state__action"><slot name="action" /></div>
  </section>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
