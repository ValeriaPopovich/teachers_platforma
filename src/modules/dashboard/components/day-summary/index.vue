<script src="./scripts/index.js" />

<template>
  <UiCard class="card day-summary" padding="lg">
    <div class="day-summary__label">Сводка дня</div>
    <div class="day-summary__stats">{{ statsLabel }}</div>

    <div class="day-summary__grid">
      <div class="day-summary__progress">
        <div class="day-ring">
          <svg class="day-ring__svg" viewBox="0 0 76 76" aria-hidden="true">
            <circle class="day-ring__track" cx="38" cy="38" r="30" />
            <circle
              class="day-ring__value"
              cx="38"
              cy="38"
              r="30"
              :stroke-dasharray="ringCircumference"
              :stroke-dashoffset="ringOffset"
              transform="rotate(-90 38 38)"
            />
          </svg>
          <div class="day-ring__center">{{ progress.percent }}<small>%</small></div>
        </div>
        <div class="day-summary__progress-text">
          <b>Прогресс дня</b>
          <small>{{ progressLabel }}</small>
        </div>
      </div>

      <div class="day-summary__income">
        <div class="day-summary__income-cap">Доход за месяц</div>
        <div class="day-summary__income-value">{{ receivedLabel }}</div>
        <template v-if="hasGoal">
          <div class="day-summary__goal-bar">
            <span class="day-summary__goal-earned" :style="goalStyle"></span>
          </div>
          <div class="day-summary__income-hint">Цель месяца {{ goalLabel }}</div>
        </template>
      </div>
    </div>
  </UiCard>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
