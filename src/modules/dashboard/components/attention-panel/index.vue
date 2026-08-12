<script src="./scripts/index.js" />

<template>
  <UiCard class="card dash-attention" padding="lg">
    <div class="dash-attention__head">
      <span class="dash-attention__title">Требует внимания</span>
      <UiBadge v-if="items.length" variant="danger">{{ items.length }}</UiBadge>
    </div>

    <div v-if="items.length" class="dash-attention__list">
      <div v-for="item in visibleItems" :key="item.id" class="dash-attention__item">
        <span
          class="dash-attention__icon"
          :class="`dash-attention__icon--${item.kind}`"
          aria-hidden="true"
        >
          {{ iconFor(item.kind) }}
        </span>
        <span class="dash-attention__text">
          <b>{{ item.title }}</b>
          <small>{{ item.subtitle }}</small>
        </span>
        <UiButton size="sm" variant="secondary" @click="onItemAction(item)">
          {{ item.actionLabel }}
        </UiButton>
      </div>
    </div>

    <p v-else class="dash-attention__empty">Сейчас нет задач, требующих внимания</p>

    <a v-if="items.length > maxVisible" class="dash-attention__more" data-page-go="payments">
      Смотреть все →
    </a>
  </UiCard>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
