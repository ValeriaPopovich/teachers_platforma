<script src="./scripts/index.js" />

<template>
  <UiEmptyState :title="content.title" :description="content.description" compact>
    <template v-if="showAction" #action>
      <UiButton variant="primary" data-open="student" @click="openNewStudent">
        + Добавить первого ученика
      </UiButton>
    </template>
  </UiEmptyState>
</template>
