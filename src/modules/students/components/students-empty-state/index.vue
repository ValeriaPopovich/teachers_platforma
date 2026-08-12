<script src="./scripts/index.js" />

<template>
  <div class="students-empty">
    <span aria-hidden="true">{{ content.icon }}</span>
    <b>{{ content.title }}</b>
    <p>{{ content.description }}</p>
    <UiButton v-if="showAction" variant="primary" data-open="student">
      + Добавить первого ученика
    </UiButton>
  </div>
</template>
