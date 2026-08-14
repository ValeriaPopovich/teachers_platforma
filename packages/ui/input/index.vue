<script src="./scripts/index.js" />

<template>
  <input
    placeholder=" "
    class="ui-input"
    v-bind="inputAttributes"
    :value="modelValue"
    @input="onInput"
  />
</template>
