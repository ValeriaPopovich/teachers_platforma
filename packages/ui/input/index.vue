<script src="./scripts/index.js" />

<template>
  <input class="ui-input" v-bind="inputAttributes" :value="modelValue" @input="onInput" />
</template>
