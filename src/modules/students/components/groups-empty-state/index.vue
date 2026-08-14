<script src="./scripts/index.js" />

<template>
  <UiEmptyState :title="content.title" :description="content.description" compact>
    <template v-if="reason === 'initial'" #action>
      <UiButton variant="secondary" @click="onActionClick">{{ content.action }}</UiButton>
    </template>
  </UiEmptyState>
</template>
