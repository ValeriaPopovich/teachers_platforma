<script src="./scripts/index.js" />

<template>
  <span class="ui-hint">
    <UiTooltip :text="text">
      <template #default="{ tooltipId }">
        <button
          class="ui-hint__trigger text-muted-foreground"
          type="button"
          :aria-label="label"
          :aria-describedby="tooltipId"
        >
          <UiIcon name="info" />
        </button>
      </template>
    </UiTooltip>
  </span>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
