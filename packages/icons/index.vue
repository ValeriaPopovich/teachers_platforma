<script src="./scripts/index.js" />

<template>
  <svg class="ui-icon" viewBox="0 0 24 24" v-bind="iconAttributes">
    <component :is="shape.tag" v-for="shape in shapes" :key="shape.key" v-bind="shape.attrs" />
  </svg>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
