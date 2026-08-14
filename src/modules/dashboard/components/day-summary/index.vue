<script src="./scripts/index.js" />

<template>
  <UiCard class="card day-summary" padding="lg">
    <div class="day-summary__label text-muted-foreground">Сводка дня</div>
    <div class="day-summary__stats text-muted-foreground">{{ statsLabel }}</div>

    <div class="day-summary__grid">
      <div class="day-summary__progress">
        <div class="day-ring">
          <svg class="day-ring__svg" viewBox="0 0 76 76" aria-hidden="true">
            <circle class="day-ring__track stroke-muted" cx="38" cy="38" r="30" />
            <circle
              class="day-ring__value stroke-secondary"
              cx="38"
              cy="38"
              r="30"
              :stroke-dasharray="ringCircumference"
              :stroke-dashoffset="ringOffset"
              transform="rotate(-90 38 38)"
            />
          </svg>
          <div class="day-ring__center text-foreground">
            {{ progress.percent }}<small class="text-muted-foreground">%</small>
          </div>
        </div>
        <div class="day-summary__progress-text">
          <b class="text-foreground">Прогресс дня</b>
          <small class="text-muted-foreground">{{ progressLabel }}</small>
        </div>
      </div>

      <div class="day-summary__income">
        <div class="day-summary__income-cap text-muted-foreground">Доход за месяц</div>
        <div class="day-summary__income-value text-foreground">{{ receivedLabel }}</div>
        <template v-if="hasGoal">
          <div class="day-summary__goal-bar bg-muted rounded-full">
            <span
              class="day-summary__goal-earned bg-primary rounded-full"
              :style="goalStyle"
            ></span>
          </div>
          <div class="day-summary__income-hint text-muted-foreground">
            Цель месяца {{ goalLabel }}
          </div>
        </template>
      </div>
    </div>
  </UiCard>
</template>

<style scoped src="./styles/index.scss" lang="scss" />
