<script src="./scripts/index.js" />

<template>
  <button
    v-for="page in pages"
    :key="page.name"
    :class="page.classes"
    :data-page="page.name"
    :title="page.title"
    :aria-label="page.title"
  >
    <span class="ico">
      <!-- SVG comes exclusively from the closed local navigation constants. -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <svg viewBox="0 0 24 24" aria-hidden="true" v-html="page.icon"></svg>
    </span>
    <span class="nav-label">{{ page.label }}</span>
    <span v-if="page.showBadge" id="paymentNavBadge" class="nav-badge" :class="page.badgeClasses">{{
      page.badgeText
    }}</span>
  </button>
</template>
