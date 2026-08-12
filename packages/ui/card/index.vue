<script src="./scripts/index.js" />

<template>
  <component :is="as" class="ui-card" :class="cardClasses"><slot /></component>
</template>
